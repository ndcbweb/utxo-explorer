import { getMeta, q, setMeta, transaction } from "./db.js";
import { rpc } from "./rpc.js";

export const state = {
  indexed: -1,
  chainHead: -1,
  syncing: false,
  lastError: "",
  lastBlockAt: 0,
};

function tipRow() {
  return q("SELECT height, hash FROM blocks ORDER BY height DESC LIMIT 1").get();
}

function addBig(key, delta) {
  setMeta(key, (BigInt(getMeta(key, "0")) + delta).toString());
}

function indexBlock(block) {
  const height = block.height;
  const touched = new Map();
  const touch = (address, txid, idx) => {
    const key = `${address}\u0000${txid}`;
    let row = touched.get(key);
    if (!row) {
      row = { address, txid, idx, received: 0n, sent: 0n };
      touched.set(key, row);
    }
    return row;
  };

  let fees = 0n;
  let coinbaseOut = 0n;
  let miner = null;
  // The genesis coinbase is not part of the UTXO set and can never be spent.
  const spendable = height > 0;

  block.tx.forEach((tx, idx) => {
    const coinbase = Boolean(tx.vin[0]?.coinbase);
    let inTotal = 0n;
    let outTotal = 0n;

    if (!coinbase) {
      for (const input of tx.vin) {
        const prev = input.prevout || {};
        const value = typeof prev.value === "bigint" ? prev.value : 0n;
        inTotal += value;
        q("UPDATE outputs SET spent_txid = ?, spent_height = ? WHERE txid = ? AND n = ?").run(tx.txid, height, input.txid, input.vout);
        const address = prev.scriptPubKey?.address;
        if (address) touch(address, tx.txid, idx).sent += value;
      }
    }

    for (const output of tx.vout) {
      const value = typeof output.value === "bigint" ? output.value : 0n;
      outTotal += value;
      const address = output.scriptPubKey?.address || null;
      if (coinbase && !miner && address) miner = address;
      if (!spendable) continue;
      q("INSERT OR REPLACE INTO outputs (txid, n, height, address, value) VALUES (?, ?, ?, ?, ?)").run(tx.txid, output.n, height, address, value);
      if (address) touch(address, tx.txid, idx).received += value;
    }

    const fee = coinbase ? 0n : typeof tx.fee === "bigint" ? tx.fee : inTotal - outTotal;
    if (coinbase) coinbaseOut = outTotal;
    else fees += fee;

    q(
      `INSERT OR REPLACE INTO txs (txid, height, idx, time, coinbase, fee, vsize, out_total, n_in, n_out)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(tx.txid, height, idx, block.time, coinbase ? 1 : 0, fee, tx.vsize ?? tx.size ?? 0, outTotal, tx.vin.length, tx.vout.length);
  });

  for (const row of touched.values()) {
    q("INSERT OR REPLACE INTO addr_txs (address, txid, height, idx, received, sent) VALUES (?, ?, ?, ?, ?, ?)").run(
      row.address,
      row.txid,
      height,
      row.idx,
      row.received,
      row.sent
    );
    q(
      `INSERT INTO addresses (address, balance, received, sent, txs, first_height, last_height) VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(address) DO UPDATE SET balance = balance + excluded.balance, received = received + excluded.received,
         sent = sent + excluded.sent, txs = txs + 1, last_height = excluded.last_height`
    ).run(row.address, row.received - row.sent, row.received, row.sent, height, height);
  }

  const issued = spendable ? coinbaseOut - fees : 0n;
  q(
    `INSERT OR REPLACE INTO blocks (height, hash, prev, time, ntx, size, weight, difficulty, bits, nonce, version, miner, reward, fees, issued)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    height,
    block.hash,
    block.previousblockhash || null,
    block.time,
    block.tx.length,
    block.size,
    block.weight,
    block.difficulty,
    block.bits,
    block.nonce,
    block.version,
    miner,
    coinbaseOut,
    fees,
    issued
  );
  addBig("supply", issued);
  addBig("tx_count", BigInt(block.tx.length));
}

function rollbackBlock(height) {
  const block = q("SELECT CAST(issued AS TEXT) AS issued, ntx FROM blocks WHERE height = ?").get(height);
  if (!block) return;
  for (const row of q("SELECT address, CAST(received AS TEXT) AS received, CAST(sent AS TEXT) AS sent FROM addr_txs WHERE height = ?").all(height)) {
    const received = BigInt(row.received);
    const sent = BigInt(row.sent);
    q("UPDATE addresses SET balance = balance - ?, received = received - ?, sent = sent - ?, txs = txs - 1 WHERE address = ?").run(
      received - sent,
      received,
      sent,
      row.address
    );
  }
  q("DELETE FROM addresses WHERE txs <= 0").run();
  q("DELETE FROM addr_txs WHERE height = ?").run(height);
  q("UPDATE outputs SET spent_txid = NULL, spent_height = NULL WHERE spent_height = ?").run(height);
  q("DELETE FROM outputs WHERE height = ?").run(height);
  q("DELETE FROM txs WHERE height = ?").run(height);
  q("DELETE FROM blocks WHERE height = ?").run(height);
  addBig("supply", -BigInt(block.issued));
  addBig("tx_count", -BigInt(block.ntx));
}

async function step() {
  const head = await rpc("getblockcount");
  state.chainHead = head;
  let tip = tipRow();
  state.indexed = tip ? tip.height : -1;
  let work = 0;

  while (state.indexed < head && work < 200) {
    const height = state.indexed + 1;
    const hash = await rpc("getblockhash", [height]);
    const block = await rpc("getblock", [hash, 3]);
    if (tip && block.previousblockhash !== tip.hash) {
      transaction(() => rollbackBlock(tip.height));
      tip = tipRow();
      state.indexed = tip ? tip.height : -1;
      continue;
    }
    transaction(() => indexBlock(block));
    tip = { height, hash: block.hash };
    state.indexed = height;
    state.lastBlockAt = Date.now();
    work += 1;
  }

  // Same height but a different tip hash: the node reorganised onto a sibling block.
  if (tip && state.indexed === head) {
    const nodeHash = await rpc("getblockhash", [tip.height]);
    if (nodeHash !== tip.hash) transaction(() => rollbackBlock(tip.height));
  }
  return work;
}

export function startIndexer(pollMs, log) {
  const loop = async () => {
    let work = 0;
    try {
      state.syncing = true;
      work = await step();
      state.lastError = "";
    } catch (error) {
      if (state.lastError !== error.message) log.warn(`indexer: ${error.message}`);
      state.lastError = error.message;
    } finally {
      state.syncing = false;
    }
    setTimeout(loop, work > 0 ? 50 : pollMs);
  };
  loop();
}
