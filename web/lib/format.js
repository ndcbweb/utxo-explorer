const COIN = 100_000_000n;

/** Satoshi string/bigint -> grouped coin text with up to `max` decimals. */
export function coin(sats, max = 8) {
  if (sats == null || sats === "") return "–";
  let value = BigInt(sats);
  const negative = value < 0n;
  if (negative) value = -value;
  const whole = (value / COIN).toLocaleString("en-US");
  let fraction = (value % COIN).toString().padStart(8, "0").slice(0, max).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function compact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function coinCompact(sats) {
  if (sats == null) return "–";
  const n = Number(BigInt(sats) / 1000n) / 100_000;
  return n >= 1_000_000 ? compact(n) : n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 8 : 2 });
}

export function hashrate(hps) {
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"];
  let n = Number(hps) || 0;
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i += 1;
  }
  return `${n.toFixed(n >= 100 ? 0 : 2)} ${units[i]}`;
}

export function bytes(n) {
  const value = Number(n) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} kB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

export function difficulty(value) {
  const n = Number(value) || 0;
  if (n >= 1000) return compact(n);
  return n.toPrecision(4).replace(/\.?0+$/, "");
}

export function ago(seconds) {
  if (!seconds) return "–";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - seconds));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function duration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 120) return `${s}s`;
  if (s < 7200) return `${Math.round(s / 60)} min`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
  if (s < 31_536_000) return `${Math.round(s / 86400)} days`;
  return `${(s / 31_536_000).toFixed(1)} years`;
}

export function date(seconds) {
  if (!seconds) return "–";
  return new Date(seconds * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });
}

export function short(hash, head = 8, tail = 8) {
  if (!hash) return "–";
  return hash.length <= head + tail + 1 ? hash : `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export const ALGORITHM_LABEL = { sha256d: "SHA-256d", scrypt: "Scrypt" };
