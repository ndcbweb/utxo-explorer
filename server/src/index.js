import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { ENV } from "./config.js";
import { getMeta, q } from "./db.js";
import { startIndexer, state } from "./indexer.js";
import { rpc, RpcError } from "./rpc.js";
import { nextReduction, subsidyAt, subsidyRules } from "./subsidy.js";

const RULES = subsidyRules(ENV.chain);
const HEX64 = /^[0-9a-f]{64}$/i;

const toJson = (payload) => JSON.stringify(payload, (key, value) => (typeof value === "bigint" ? value.toString() : value));

const app = Fastify({ trustProxy: "127.0.0.1", logger: { level: "info" } });
app.setReplySerializer(toJson);

app.addHook("onSend", async (request, reply, payload) => {
  reply.header(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
  );
  reply.header("x-content-type-options", "nosniff");
  reply.header("referrer-policy", "strict-origin-when-cross-origin");
  return payload;
});

await app.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: "1 minute",
  allowList: (request) => request.url === "/api/health",
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof RpcError) {
    const notFound = error.code === -5 || error.code === -8;
    return reply.code(notFound ? 404 : 502).send({ ok: false, error: notFound ? "Not found" : error.message });
  }
  if (error.name === "TimeoutError" || error.cause?.code === "ECONNREFUSED") {
    return reply.code(503).send({ ok: false, error: "The node is not reachable right now" });
  }
  reply.code(error.statusCode || 500).send({ ok: false, error: error.message || "Request failed" });
});

/** Max supply in satoshis, or null when a tail reward keeps issuing forever. */
function maxSupply() {
  let total = 0n;
  for (let s = 0; s <= RULES.maxSteps; s += 1) {
    const reward = subsidyAt(Math.max(s * RULES.interval, 2), RULES);
    if (s === RULES.maxSteps || RULES.interval <= 0) {
      if (reward > 0n) return null;
      break;
    }
    total += reward * BigInt(s === 0 ? RULES.interval - 1 : RULES.interval);
    if (reward === 0n) break;
  }
  if (RULES.premine > 0n) total += RULES.premine - subsidyAt(2, RULES);
  return total;
}
const MAX_SUPPLY = maxSupply();

function memo(ms, load) {
  let value;
  let at = 0;
  let pending = null;
  return async () => {
    if (value !== undefined && Date.now() - at < ms) return value;
    pending ||= load()
      .then((result) => {
        value = result;
        at = Date.now();
        return result;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}

const nodeStats = memo(4000, async () => {
  const [chain, mining, mempool, network] = await Promise.all([
    rpc("getblockchaininfo"),
    rpc("getmininginfo"),
    rpc("getmempoolinfo"),
    rpc("getnetworkinfo"),
  ]);
  return { chain, mining, mempool, network };
});

function chainRules() {
  const c = ENV.chain;
  return {
    algorithm: c.algorithm || "sha256d",
    blockSpacing: c.blockSpacing ?? 600,
    retargetInterval: c.retargetInterval ?? 2016,
    port: c.port ?? null,
    messageStart: c.messageStart ?? null,
    bech32: c.bech32 ?? null,
    base58: c.base58 ?? null,
    genesis: c.genesis ? { time: c.genesis.time, hash: c.genesis.hash, message: c.genesis.message } : null,
    subsidy: {
      initial: RULES.initial,
      interval: RULES.interval,
      maxSteps: RULES.maxSteps,
      percent: RULES.percent,
      tail: RULES.tail,
      premine: RULES.premine,
    },
    maxSupply: MAX_SUPPLY,
  };
}

app.get("/api/health", async () => ({
  ok: state.chainHead >= 0 && !state.lastError,
  indexed: state.indexed,
  chainHead: state.chainHead,
  syncing: state.indexed < state.chainHead,
  error: state.lastError || undefined,
}));

app.get("/api/info", async () => {
  const stats = await nodeStats().catch(() => null);
  const recent = q("SELECT height, time FROM blocks ORDER BY height DESC LIMIT 101").all();
  const span = recent.length > 1 ? recent[0].time - recent[recent.length - 1].time : 0;
  const height = stats?.chain.blocks ?? state.indexed;
  return {
    chainName: ENV.chainName,
    symbol: ENV.symbol,
    rules: chainRules(),
    publicRpc: ENV.publicRpc,
    seeds: ENV.seeds,
    node: stats
      ? {
          height,
          bestHash: stats.chain.bestblockhash,
          difficulty: stats.chain.difficulty,
          hashrate: stats.mining.networkhashps,
          chainwork: stats.chain.chainwork,
          sizeOnDisk: stats.chain.size_on_disk,
          peers: stats.network.connections,
          version: stats.network.subversion,
          mempool: { count: stats.mempool.size, bytes: stats.mempool.bytes, fees: stats.mempool.total_fee },
        }
      : null,
    index: { indexed: state.indexed, chainHead: state.chainHead },
    supply: getMeta("supply", "0"),
    txCount: Number(getMeta("tx_count", "0")),
    addressCount: q("SELECT COUNT(*) AS n FROM addresses WHERE balance > 0").get().n,
    avgBlockTime: recent.length > 1 ? span / (recent.length - 1) : null,
    reward: subsidyAt(Math.max(height + 1, 2), RULES),
    nextReduction: nextReduction(height + 1, RULES),
  };
});

const BLOCK_COLUMNS = `height, hash, prev, time, ntx, size, weight, difficulty, bits, nonce, version, miner,
  CAST(reward AS TEXT) AS reward, CAST(fees AS TEXT) AS fees, CAST(issued AS TEXT) AS issued`;

const clampLimit = (value, fallback, max) => Math.min(max, Math.max(1, Number(value) || fallback));

app.get("/api/blocks", async (request) => {
  const limit = clampLimit(request.query.limit, 25, 100);
  const before = Number.isInteger(Number(request.query.before)) && request.query.before !== undefined ? Number(request.query.before) : null;
  const blocks =
    before == null
      ? q(`SELECT ${BLOCK_COLUMNS} FROM blocks ORDER BY height DESC LIMIT ?`).all(limit)
      : q(`SELECT ${BLOCK_COLUMNS} FROM blocks WHERE height < ? ORDER BY height DESC LIMIT ?`).all(before, limit);
  return { blocks, tip: state.indexed };
});

app.get("/api/charts", async () => {
  const blocks = q("SELECT height, time, difficulty, ntx, size FROM blocks ORDER BY height DESC LIMIT 144").all().reverse();
  const miners = q(
    `SELECT miner, COUNT(*) AS blocks FROM (SELECT miner FROM blocks WHERE height > 0 ORDER BY height DESC LIMIT 1000)
     GROUP BY miner ORDER BY blocks DESC LIMIT 10`
  ).all();
  return { blocks, miners };
});

app.get("/api/txs", async (request) => {
  const limit = clampLimit(request.query.limit, 25, 100);
  return {
    txs: q(
      `SELECT txid, height, idx, time, coinbase, CAST(fee AS TEXT) AS fee, vsize, CAST(out_total AS TEXT) AS outTotal, n_in AS nIn, n_out AS nOut
       FROM txs ORDER BY height DESC, idx DESC LIMIT ?`
    ).all(limit),
  };
});

app.get("/api/block/:id", async (request, reply) => {
  const id = String(request.params.id);
  const block = /^\d+$/.test(id)
    ? q(`SELECT ${BLOCK_COLUMNS} FROM blocks WHERE height = ?`).get(Number(id))
    : q(`SELECT ${BLOCK_COLUMNS} FROM blocks WHERE hash = ?`).get(id.toLowerCase());
  if (!block) return reply.code(404).send({ ok: false, error: "Block not found" });
  const limit = clampLimit(request.query.limit, 25, 100);
  const offset = Math.max(0, Number(request.query.offset) || 0);
  const txs = q(
    `SELECT txid, idx, coinbase, CAST(fee AS TEXT) AS fee, vsize, CAST(out_total AS TEXT) AS outTotal, n_in AS nIn, n_out AS nOut
     FROM txs WHERE height = ? ORDER BY idx LIMIT ? OFFSET ?`
  ).all(block.height, limit, offset);
  const next = q("SELECT hash FROM blocks WHERE height = ?").get(block.height + 1);
  return {
    block: {
      ...block,
      next: next?.hash || null,
      confirmations: state.indexed - block.height + 1,
      subsidy: block.height === 0 ? "0" : subsidyAt(block.height, RULES),
    },
    txs,
  };
});

function mapTx(tx) {
  const spent = new Map(
    q("SELECT n, spent_txid, spent_height FROM outputs WHERE txid = ? AND spent_txid IS NOT NULL")
      .all(tx.txid)
      .map((row) => [row.n, { txid: row.spent_txid, height: row.spent_height }])
  );
  const coinbase = Boolean(tx.vin[0]?.coinbase);
  return {
    txid: tx.txid,
    hash: tx.hash,
    size: tx.size,
    vsize: tx.vsize,
    weight: tx.weight,
    version: tx.version,
    locktime: tx.locktime,
    coinbase,
    fee: tx.fee ?? null,
    blockhash: tx.blockhash || null,
    confirmations: tx.confirmations || 0,
    time: tx.blocktime || tx.time || null,
    vin: tx.vin.map((input) =>
      input.coinbase
        ? { coinbase: input.coinbase }
        : {
            txid: input.txid,
            vout: input.vout,
            address: input.prevout?.scriptPubKey?.address || null,
            value: input.prevout?.value ?? null,
            type: input.prevout?.scriptPubKey?.type || null,
            witness: Array.isArray(input.txinwitness) ? input.txinwitness.length : 0,
          }
    ),
    vout: tx.vout.map((output) => ({
      n: output.n,
      value: output.value,
      address: output.scriptPubKey?.address || null,
      type: output.scriptPubKey?.type || null,
      asm: output.scriptPubKey?.type === "nulldata" ? output.scriptPubKey.asm : undefined,
      spent: spent.get(output.n) || null,
    })),
  };
}

app.get("/api/tx/:txid", async (request, reply) => {
  const txid = String(request.params.txid).toLowerCase();
  if (!HEX64.test(txid)) return reply.code(400).send({ ok: false, error: "Enter a 64 character transaction id" });
  const row = q("SELECT height FROM txs WHERE txid = ?").get(txid);
  let tx;
  if (row?.height === 0) {
    const hash = await rpc("getblockhash", [0]);
    const block = await rpc("getblock", [hash, 3]);
    tx = { ...block.tx[0], blockhash: hash, blocktime: block.time, confirmations: block.confirmations };
  } else {
    tx = await rpc("getrawtransaction", [txid, 2]);
  }
  const mapped = mapTx(tx);
  return { tx: { ...mapped, height: row?.height ?? null } };
});

app.get("/api/address/:address", async (request, reply) => {
  const address = String(request.params.address).trim();
  const check = await rpc("validateaddress", [address]);
  if (!check.isvalid) return reply.code(400).send({ ok: false, error: "This is not an address on this chain" });
  const limit = clampLimit(request.query.limit, 25, 100);
  const offset = Math.max(0, Number(request.query.offset) || 0);
  const summary = q(
    `SELECT CAST(balance AS TEXT) AS balance, CAST(received AS TEXT) AS received, CAST(sent AS TEXT) AS sent, txs, first_height AS firstHeight, last_height AS lastHeight
     FROM addresses WHERE address = ?`
  ).get(address);
  const history = q(
    `SELECT a.txid, a.height, a.idx, CAST(a.received AS TEXT) AS received, CAST(a.sent AS TEXT) AS sent, t.time, t.coinbase
     FROM addr_txs a JOIN txs t ON t.txid = a.txid WHERE a.address = ? ORDER BY a.height DESC, a.idx DESC LIMIT ? OFFSET ?`
  ).all(address, limit, offset);
  const utxos = q(
    "SELECT txid, n, height, CAST(value AS TEXT) AS value FROM outputs WHERE address = ? AND spent_txid IS NULL ORDER BY height DESC LIMIT 50"
  ).all(address);
  const utxoCount = q("SELECT COUNT(*) AS n FROM outputs WHERE address = ? AND spent_txid IS NULL").get(address).n;
  const rank = summary ? q("SELECT COUNT(*) + 1 AS n FROM addresses WHERE balance > ?").get(BigInt(summary.balance)).n : null;
  return {
    address,
    type: check.iswitness ? (check.witness_version === 1 ? "Taproot" : "SegWit") : check.isscript ? "Script" : "Legacy",
    summary: summary || { balance: "0", received: "0", sent: "0", txs: 0, firstHeight: null, lastHeight: null },
    rank,
    history,
    utxos,
    utxoCount,
  };
});

app.get("/api/richlist", async (request) => {
  const limit = clampLimit(request.query.limit, 100, 500);
  return {
    supply: getMeta("supply", "0"),
    holders: q("SELECT COUNT(*) AS n FROM addresses WHERE balance > 0").get().n,
    accounts: q(
      `SELECT address, CAST(balance AS TEXT) AS balance, txs, last_height AS lastHeight FROM addresses
       WHERE balance > 0 ORDER BY balance DESC LIMIT ?`
    ).all(limit),
  };
});

app.get("/api/mempool", async () => {
  const [info, pool] = await Promise.all([rpc("getmempoolinfo"), rpc("getrawmempool", [true])]);
  const txs = Object.entries(pool)
    .map(([txid, entry]) => ({ txid, vsize: entry.vsize, fee: entry.fees?.base ?? 0n, time: entry.time }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 100);
  return { info: { count: info.size, bytes: info.bytes, fees: info.total_fee, minFee: info.mempoolminfee }, txs };
});

app.get("/api/search", async (request, reply) => {
  const query = String(request.query.q || "").trim();
  if (!query) return reply.code(400).send({ ok: false, error: "Enter a block, transaction or address" });
  if (/^\d+$/.test(query)) {
    const height = Number(query);
    if (q("SELECT 1 FROM blocks WHERE height = ?").get(height)) return { type: "block", id: String(height) };
    return reply.code(404).send({ ok: false, error: `Block ${height} has not been mined yet` });
  }
  if (HEX64.test(query)) {
    const hash = query.toLowerCase();
    if (q("SELECT 1 FROM blocks WHERE hash = ?").get(hash)) return { type: "block", id: hash };
    if (q("SELECT 1 FROM txs WHERE txid = ?").get(hash)) return { type: "tx", id: hash };
    const inPool = await rpc("getmempoolentry", [hash]).catch(() => null);
    if (inPool) return { type: "tx", id: hash };
    return reply.code(404).send({ ok: false, error: "No block or transaction with that hash" });
  }
  const check = await rpc("validateaddress", [query]).catch(() => null);
  if (check?.isvalid) return { type: "address", id: query };
  return reply.code(404).send({ ok: false, error: "Nothing matches that search" });
});

app.get("/api/*", async (request, reply) => reply.code(404).send({ ok: false, error: "Not found" }));

await app.register(fastifyStatic, { root: ENV.webDir, prefix: "/", redirect: true });
app.setNotFoundHandler((request, reply) => reply.code(404).sendFile("404.html"));

startIndexer(ENV.pollMs, app.log);
await app.listen({ port: ENV.port, host: "0.0.0.0" });
app.log.info(`${ENV.chainName} explorer on :${ENV.port}, node ${ENV.rpcUrl}`);
