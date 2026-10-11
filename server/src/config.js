import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;

function readChainFile(path) {
  if (!path || !existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

const chain = readChainFile(env.CHAIN_FILE);

export const ENV = {
  port: Number(env.PORT) || 4200,
  dataDir: env.DATA_DIR || resolve(here, "../.data"),
  webDir: env.WEB_DIR || resolve(here, "../../web/out"),
  rpcUrl: (env.RPC_URL || "http://127.0.0.1:8332").replace(/\/+$/, ""),
  rpcUser: env.RPC_USER || "",
  rpcPass: env.RPC_PASS || "",
  rpcCookie: env.RPC_COOKIE || "",
  pollMs: Math.max(1000, Number(env.POLL_MS) || 3000),
  chain,
  chainName: env.CHAIN_NAME || chain.name || "Nadcab Chain",
  symbol: env.CURRENCY_SYMBOL || chain.ticker || "COIN",
  publicRpc: {
    url: env.PUBLIC_RPC_URL || "",
    user: env.PUBLIC_RPC_USER || "",
    pass: env.PUBLIC_RPC_PASS || "",
  },
  seeds: String(env.P2P_SEEDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
};
