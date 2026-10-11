import { existsSync, readFileSync } from "node:fs";
import { ENV } from "./config.js";

const AMOUNT_KEYS = new Set(["value", "fee", "base", "modified", "ancestor", "descendant", "total_fee", "mempoolminfee", "minrelaytxfee"]);
const AMOUNT_RE = /^-?\d+(\.\d+)?(e-?\d+)?$/i;

/** Decimal coin text -> integer satoshis without going through a float. */
export function toSats(text) {
  let value = String(text);
  if (/e/i.test(value)) value = Number(value).toFixed(8);
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const sats = BigInt(whole || "0") * 100_000_000n + BigInt((fraction + "00000000").slice(0, 8));
  return negative ? -sats : sats;
}

/** JSON.parse that keeps every coin amount exact as a BigInt of satoshis. */
function parseExact(text) {
  return JSON.parse(text, (key, value, context) => {
    if (typeof value === "number" && AMOUNT_KEYS.has(key) && context?.source && AMOUNT_RE.test(context.source)) {
      return toSats(context.source);
    }
    return value;
  });
}

function authHeader() {
  if (ENV.rpcUser) return `Basic ${Buffer.from(`${ENV.rpcUser}:${ENV.rpcPass}`).toString("base64")}`;
  if (ENV.rpcCookie && existsSync(ENV.rpcCookie)) {
    return `Basic ${Buffer.from(readFileSync(ENV.rpcCookie, "utf8").trim()).toString("base64")}`;
  }
  return "";
}

export class RpcError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

let nextId = 1;

export async function rpc(method, params = [], { timeout = 30_000 } = {}) {
  const auth = authHeader();
  const response = await fetch(ENV.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify({ jsonrpc: "1.0", id: nextId++, method, params }),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  if (!text) throw new RpcError(`RPC ${method} failed with HTTP ${response.status}`, response.status);
  const body = parseExact(text);
  if (body.error) throw new RpcError(body.error.message || `RPC ${method} failed`, body.error.code);
  return body.result;
}
