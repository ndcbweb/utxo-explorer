"use client";

import { useChain } from "@/components/Shell";
import { Card, Empty, HashLink, PageTitle } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, coin } from "@/lib/format";

export default function Transactions() {
  const { info } = useChain();
  const { data, loading, error } = useApi("/txs?limit=50", { refreshMs: 8000 });
  const txs = data?.txs || [];

  return (
    <>
      <PageTitle title="Transactions" sub={info ? `${info.txCount.toLocaleString()} confirmed transactions` : ""} />
      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Block</th>
                <th>Age</th>
                <th>Type</th>
                <th className="text-right">Inputs / outputs</th>
                <th className="text-right">Fee</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.txid}>
                  <td>
                    <HashLink type="tx" id={t.txid} head={12} tail={8} />
                  </td>
                  <td>
                    <HashLink type="block" id={String(t.height)} label={t.height.toLocaleString()} />
                  </td>
                  <td className="text-muted">{ago(t.time)}</td>
                  <td>{t.coinbase ? <span className="chip text-[#c99400] dark:text-brand">Coinbase</span> : <span className="chip">Transfer</span>}</td>
                  <td className="text-right tabular-nums">
                    {t.coinbase ? "–" : t.nIn} / {t.nOut}
                  </td>
                  <td className="text-right tabular-nums text-muted">{t.coinbase ? "–" : coin(t.fee)}</td>
                  <td className="text-right tabular-nums">
                    {coin(t.outTotal, 4)} {info?.symbol}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!txs.length ? <Empty>{loading ? "Loading…" : error || "No transactions yet"}</Empty> : null}
      </Card>
    </>
  );
}
