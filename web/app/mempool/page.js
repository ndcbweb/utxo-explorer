"use client";

import { useChain } from "@/components/Shell";
import { Card, Empty, HashLink, PageTitle, Stat } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, bytes, coin } from "@/lib/format";

export default function Mempool() {
  const { info } = useChain();
  const { data, loading, error } = useApi("/mempool", { refreshMs: 5000 });
  const txs = data?.txs || [];
  const symbol = info?.symbol || "";

  return (
    <>
      <PageTitle title="Mempool" sub="Transactions broadcast to the network and waiting to be mined" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending transactions" value={data ? data.info.count.toLocaleString() : "–"} />
        <Stat label="Size" value={data ? bytes(data.info.bytes) : "–"} />
        <Stat label="Total fees" value={data ? `${coin(data.info.fees)} ${symbol}` : "–"} />
        <Stat label="Minimum fee rate" value={data ? `${coin(data.info.minFee)} ${symbol}/kvB` : "–"} />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Seen</th>
                <th className="text-right">Size</th>
                <th className="text-right">Fee</th>
                <th className="text-right">Fee rate</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.txid}>
                  <td>
                    <HashLink type="tx" id={t.txid} head={16} tail={10} />
                  </td>
                  <td className="text-muted">{ago(t.time)}</td>
                  <td className="text-right tabular-nums">{t.vsize} vB</td>
                  <td className="text-right tabular-nums">
                    {coin(t.fee)} {symbol}
                  </td>
                  <td className="text-right tabular-nums">{(Number(t.fee) / t.vsize).toFixed(1)} sat/vB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!txs.length ? <Empty>{loading ? "Loading…" : error || "The mempool is empty, every transaction has been mined"}</Empty> : null}
      </Card>
    </>
  );
}
