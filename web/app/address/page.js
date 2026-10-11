"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useChain } from "@/components/Shell";
import { Card, Copy, Empty, ErrorBox, HashLink, Loading, PageTitle, Pager, Stat } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, coin } from "@/lib/format";

const PAGE = 25;

function AddressView() {
  const id = useSearchParams().get("id") || "";
  const { info } = useChain();
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [id]);
  const [tab, setTab] = useState("history");
  const { data, error, loading } = useApi(id ? `/address/${encodeURIComponent(id)}?limit=${PAGE}&offset=${offset}` : null, { refreshMs: 15_000 });
  const symbol = info?.symbol || "";

  if (!id) return <ErrorBox message="No address selected" />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} />;
  const s = data.summary;

  return (
    <>
      <PageTitle
        title="Address"
        sub={
          <>
            <span className="mono truncate">{data.address}</span>
            <Copy text={data.address} />
            <span className="chip ml-1">{data.type}</span>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Balance" value={`${coin(s.balance)} ${symbol}`} accent sub={data.rank ? `Rank #${data.rank.toLocaleString()} in the rich list` : undefined} />
        <Stat label="Total received" value={`${coin(s.received, 4)} ${symbol}`} />
        <Stat label="Total sent" value={`${coin(s.sent, 4)} ${symbol}`} />
        <Stat label="Transactions" value={s.txs.toLocaleString()} sub={`${data.utxoCount.toLocaleString()} unspent outputs`} />
      </div>

      <Card>
        <div className="flex gap-1 px-4 pt-3">
          {[
            ["history", "Transactions"],
            ["utxos", `Unspent outputs (${data.utxoCount})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? "bg-black/5 dark:bg-white/10" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "history" ? (
          <>
            <div className="overflow-x-auto">
              <table className="table mt-2">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Block</th>
                    <th>Age</th>
                    <th className="text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => {
                    const delta = BigInt(h.received) - BigInt(h.sent);
                    return (
                      <tr key={h.txid}>
                        <td>
                          <HashLink type="tx" id={h.txid} head={16} tail={8} />
                          {h.coinbase ? <span className="chip ml-2 text-[#c99400] dark:text-brand">Mined</span> : null}
                        </td>
                        <td>
                          <HashLink type="block" id={String(h.height)} label={h.height.toLocaleString()} />
                        </td>
                        <td className="text-muted">{ago(h.time)}</td>
                        <td className={`text-right tabular-nums ${delta >= 0n ? "text-up" : "text-down"}`}>
                          {delta >= 0n ? "+" : ""}
                          {coin(delta)} {symbol}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!data.history.length ? <Empty>No confirmed transactions for this address yet</Empty> : null}
            {s.txs > PAGE ? (
              <Pager
                label={`${offset + 1}–${Math.min(offset + PAGE, s.txs)} of ${s.txs.toLocaleString()}`}
                onPrev={() => setOffset((v) => Math.max(0, v - PAGE))}
                onNext={() => setOffset((v) => v + PAGE)}
                prevDisabled={offset === 0}
                nextDisabled={offset + PAGE >= s.txs}
              />
            ) : null}
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table mt-2">
                <thead>
                  <tr>
                    <th>Output</th>
                    <th>Block</th>
                    <th className="text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.utxos.map((u) => (
                    <tr key={`${u.txid}:${u.n}`}>
                      <td>
                        <HashLink type="tx" id={u.txid} head={16} tail={8} />
                        <span className="text-muted">:{u.n}</span>
                      </td>
                      <td>
                        <HashLink type="block" id={String(u.height)} label={u.height.toLocaleString()} />
                      </td>
                      <td className="text-right tabular-nums">
                        {coin(u.value)} {symbol}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.utxos.length ? <Empty>No unspent outputs</Empty> : null}
            {data.utxoCount > data.utxos.length ? <Empty>Showing the newest {data.utxos.length} unspent outputs</Empty> : null}
          </>
        )}
      </Card>
    </>
  );
}

export default function AddressPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AddressView />
    </Suspense>
  );
}
