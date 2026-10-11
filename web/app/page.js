"use client";

import Link from "next/link";
import { SearchBar, useChain } from "@/components/Shell";
import { Card, Empty, HashLink, Spark, Stat } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ALGORITHM_LABEL, ago, bytes, coin, coinCompact, compact, difficulty, duration, hashrate } from "@/lib/format";

function SupplyBar({ supply, max }) {
  if (!max || max === "0") return null;
  const pct = Number((BigInt(supply) * 10000n) / BigInt(max)) / 100;
  return (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mt-1.5 text-xs text-muted">{pct.toFixed(2)}% of max supply mined</div>
    </div>
  );
}

export default function Home() {
  const { info } = useChain();
  const blocks = useApi("/blocks?limit=8", { refreshMs: 5000 });
  const txs = useApi("/txs?limit=8", { refreshMs: 5000 });
  const charts = useApi("/charts", { refreshMs: 30_000 });

  const node = info?.node;
  const rules = info?.rules;
  const symbol = info?.symbol || "";
  const height = node?.height ?? info?.index?.chainHead;
  const series = charts.data?.blocks || [];
  const intervals = series.slice(1).map((b, i) => b.time - series[i].time);
  const next = info?.nextReduction;
  const spacing = rules?.blockSpacing || 600;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-black/5 bg-white px-6 py-8 sm:px-10 sm:py-10 dark:border-white/5 dark:bg-panel">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="chip">{ALGORITHM_LABEL[rules?.algorithm] || "Proof of Work"}</span>
            <span className="chip">{duration(spacing)} blocks</span>
            {node ? (
              <span className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-up" /> {node.peers} peers
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{info?.chainName || "Explorer"}</h1>
          <p className="mt-2 text-sm text-muted">
            Blocks, transactions, addresses and mining for the {symbol || "native"} Proof of Work chain.
          </p>
          <div className="mt-6">
            <SearchBar large />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Block height" value={height != null ? Number(height).toLocaleString() : "–"} sub={series.length ? `Last block ${ago(series[series.length - 1].time)}` : undefined} />
        <Stat label="Network hashrate" value={node ? hashrate(node.hashrate) : "–"} sub={node ? `Difficulty ${difficulty(node.difficulty)}` : undefined} />
        <Stat
          label="Block reward"
          value={info ? `${coin(info.reward, 4)} ${symbol}` : "–"}
          accent
          sub={next ? `→ ${coin(next.reward, 4)} at #${next.height.toLocaleString()}` : "Fixed from here on"}
        />
        <Stat
          label="Average block time"
          value={info?.avgBlockTime ? duration(info.avgBlockTime) : "–"}
          sub={`Target ${duration(spacing)}`}
        />
        <div className="card col-span-2 p-4">
          <div className="label">Circulating supply</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">
            {info ? `${coin(info.supply, 2)} ${symbol}` : "–"}
          </div>
          <div className="mt-1 text-xs text-muted">
            {rules ? (rules.maxSupply ? `Max supply ${coinCompact(rules.maxSupply)} ${symbol}` : "No hard cap, tail emission continues forever") : ""}
          </div>
          {info && rules?.maxSupply ? <SupplyBar supply={info.supply} max={rules.maxSupply} /> : null}
        </div>
        <Stat label="Transactions" value={info ? compact(info.txCount) : "–"} sub={info ? `${compact(info.addressCount)} funded addresses` : undefined} />
        <Stat
          label="Mempool"
          value={node ? `${node.mempool.count.toLocaleString()} tx` : "–"}
          sub={node ? `${bytes(node.mempool.bytes)} waiting` : undefined}
        />
      </div>

      {next && height != null ? (
        <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <div>
            <div className="label">Next reward change</div>
            <div className="mt-1 text-sm font-semibold">Block #{next.height.toLocaleString()}</div>
          </div>
          <div className="min-w-48 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className="h-full bg-brand"
                style={{
                  width: `${Math.min(100, (100 * (Number(height) % rules.subsidy.interval)) / rules.subsidy.interval)}%`,
                }}
              />
            </div>
            <div className="mt-1.5 text-xs text-muted">
              {(next.height - Number(height)).toLocaleString()} blocks left, about {duration((next.height - Number(height)) * (info.avgBlockTime || spacing))}
            </div>
          </div>
          <Link href="/rules/" className="btn-ghost">
            Emission schedule
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Difficulty" action={<span className="text-xs text-muted">Last {series.length} blocks</span>} bodyClass="px-2 pb-3">
          <Spark values={series.map((b) => b.difficulty)} />
        </Card>
        <Card title="Block interval" action={<span className="text-xs text-muted">Seconds between blocks</span>} bodyClass="px-2 pb-3">
          <Spark values={intervals} stroke="var(--color-up)" />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card
          title="Latest blocks"
          action={
            <Link href="/blocks/" className="link text-sm">
              View all
            </Link>
          }
        >
          {blocks.data?.blocks?.length ? (
            <ul>
              {blocks.data.blocks.map((b) => (
                <li key={b.hash} className="flex items-center gap-3 border-t border-black/5 px-5 py-3 dark:border-white/5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/5 text-xs font-semibold dark:bg-white/5">Bk</span>
                  <div className="min-w-0 flex-1">
                    <HashLink type="block" id={String(b.height)} label={`#${b.height.toLocaleString()}`} />
                    <div className="text-xs text-muted">{ago(b.time)}</div>
                  </div>
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <div className="truncate text-xs text-muted">
                      Miner <HashLink type="address" id={b.miner} head={6} tail={6} />
                    </div>
                    <div className="text-xs text-muted">{b.ntx} tx</div>
                  </div>
                  <span className="chip tabular-nums">
                    {coin(b.reward, 3)} {symbol}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{blocks.loading ? "Loading…" : "No blocks indexed yet"}</Empty>
          )}
        </Card>
        <Card
          title="Latest transactions"
          action={
            <Link href="/txs/" className="link text-sm">
              View all
            </Link>
          }
        >
          {txs.data?.txs?.length ? (
            <ul>
              {txs.data.txs.map((t) => (
                <li key={t.txid} className="flex items-center gap-3 border-t border-black/5 px-5 py-3 dark:border-white/5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/5 text-xs font-semibold dark:bg-white/5">Tx</span>
                  <div className="min-w-0 flex-1">
                    <HashLink type="tx" id={t.txid} head={10} tail={6} />
                    <div className="text-xs text-muted">
                      {t.coinbase ? "Coinbase" : `${t.nIn} in · ${t.nOut} out`} · {ago(t.time)}
                    </div>
                  </div>
                  <span className="chip tabular-nums">
                    {coin(t.outTotal, 3)} {symbol}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{txs.loading ? "Loading…" : "No transactions yet"}</Empty>
          )}
        </Card>
      </div>

      {charts.data?.miners?.length ? (
        <Card title="Top miners" action={<span className="text-xs text-muted">Last 1,000 blocks</span>}>
          <table className="table">
            <tbody>
              {charts.data.miners.map((m) => {
                const total = charts.data.miners.reduce((sum, item) => sum + item.blocks, 0);
                const pct = (100 * m.blocks) / total;
                return (
                  <tr key={m.miner || "unknown"}>
                    <td className="w-full">
                      {m.miner ? <HashLink type="address" id={m.miner} head={14} tail={10} /> : <span className="text-muted">Unknown script</span>}
                    </td>
                    <td className="tabular-nums">{m.blocks.toLocaleString()} blocks</td>
                    <td className="w-48">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs tabular-nums text-muted">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
