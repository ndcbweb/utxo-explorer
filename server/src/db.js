import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ENV } from "./config.js";

mkdirSync(ENV.dataDir, { recursive: true });

export const db = new DatabaseSync(join(ENV.dataDir, "index.db"));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS blocks (
  height INTEGER PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  prev TEXT,
  time INTEGER NOT NULL,
  ntx INTEGER NOT NULL,
  size INTEGER NOT NULL,
  weight INTEGER NOT NULL,
  difficulty REAL NOT NULL,
  bits TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  version INTEGER NOT NULL,
  miner TEXT,
  reward INTEGER NOT NULL,
  fees INTEGER NOT NULL,
  issued INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS txs (
  txid TEXT PRIMARY KEY,
  height INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  time INTEGER NOT NULL,
  coinbase INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  vsize INTEGER NOT NULL,
  out_total INTEGER NOT NULL,
  n_in INTEGER NOT NULL,
  n_out INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS txs_height ON txs (height DESC, idx);

CREATE TABLE IF NOT EXISTS outputs (
  txid TEXT NOT NULL,
  n INTEGER NOT NULL,
  height INTEGER NOT NULL,
  address TEXT,
  value INTEGER NOT NULL,
  spent_txid TEXT,
  spent_height INTEGER,
  PRIMARY KEY (txid, n)
);
CREATE INDEX IF NOT EXISTS outputs_address ON outputs (address, spent_txid);
CREATE INDEX IF NOT EXISTS outputs_spent_height ON outputs (spent_height);
CREATE INDEX IF NOT EXISTS outputs_height ON outputs (height);

CREATE TABLE IF NOT EXISTS addr_txs (
  address TEXT NOT NULL,
  txid TEXT NOT NULL,
  height INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  received INTEGER NOT NULL,
  sent INTEGER NOT NULL,
  PRIMARY KEY (address, txid)
);
CREATE INDEX IF NOT EXISTS addr_txs_history ON addr_txs (address, height DESC, idx DESC);
CREATE INDEX IF NOT EXISTS addr_txs_height ON addr_txs (height);

CREATE TABLE IF NOT EXISTS addresses (
  address TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  received INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  txs INTEGER NOT NULL DEFAULT 0,
  first_height INTEGER,
  last_height INTEGER
);
CREATE INDEX IF NOT EXISTS addresses_balance ON addresses (balance DESC);
`);

const cache = new Map();

/** Cached prepared statement. Amount columns are selected with CAST(... AS TEXT) to stay exact. */
export function q(sql) {
  let statement = cache.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    cache.set(sql, statement);
  }
  return statement;
}

export function getMeta(key, fallback = null) {
  return q("SELECT value FROM meta WHERE key = ?").get(key)?.value ?? fallback;
}

export function setMeta(key, value) {
  q("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

export function transaction(work) {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
