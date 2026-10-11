"use client";

import { useChain } from "@/components/Shell";
import { Card, Empty, HashLink, PageTitle } from "@/components/ui";
import { useApi } from "@/lib/api";
import { coin } from "@/lib/format";

export default function RichList() {
  const { info } = useChain();
  const { data, loading, error } = useApi("/richlist?limit=200", { refreshMs: 30_000 });
  const supply = data ? BigInt(data.supply) : 0n;
  const accounts = data?.accounts || [];
  const top10 = accounts.slice(0, 10).reduce((sum, a) => sum + BigInt(a.balance), 0n);
  const share = (value) => (supply > 0n ? Number((BigInt(value) * 1_000_000n) / supply) / 10_000 : 0);

  return (
    <>
      <PageTitle
        title="Rich list"
        sub={data ? `${data.holders.toLocaleString()} funded addresses · top 10 hold ${share(top10).toFixed(2)}% of supply` : ""}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Address</th>
                <th className="text-right">Balance</th>
                <th className="w-56">Share of supply</th>
                <th className="text-right">Txs</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => {
                const pct = share(a.balance);
                return (
                  <tr key={a.address}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <HashLink type="address" id={a.address} full />
                    </td>
                    <td className="text-right tabular-nums">
                      {coin(a.balance, 4)} {info?.symbol}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                          <div className="h-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="w-16 text-right text-xs tabular-nums text-muted">{pct.toFixed(pct < 0.01 ? 4 : 2)}%</span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{a.txs.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!accounts.length ? <Empty>{loading ? "Loading…" : error || "No funded addresses yet"}</Empty> : null}
      </Card>
    </>
  );
}
