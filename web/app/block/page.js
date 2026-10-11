"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useChain } from "@/components/Shell";
import { Card, Copy, ErrorBox, HashLink, Loading, PageTitle, Pager, Row } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, bytes, coin, date, difficulty } from "@/lib/format";

const PAGE = 25;

function BlockView() {
  const id = useSearchParams().get("id") || "";
  const { info } = useChain();
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [id]);
  const { data, error, loading } = useApi(id ? `/block/${encodeURIComponent(id)}?limit=${PAGE}&offset=${offset}` : null);
  const symbol = info?.symbol || "";

  if (!id) return <ErrorBox message="No block selected" />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} />;
  const b = data.block;

  return (
    <>
      <PageTitle
        title={`Block #${b.height.toLocaleString()}`}
        sub={
          <>
            <span className="mono truncate">{b.hash}</span>
            <Copy text={b.hash} />
          </>
        }
      >
        <div className="flex gap-2">
          <Link className="btn-ghost" href={`/block/?id=${b.height - 1}`} aria-disabled={b.height === 0} style={b.height === 0 ? { pointerEvents: "none", opacity: 0.4 } : undefined}>
            ← Previous
          </Link>
          <Link className="btn-ghost" href={`/block/?id=${b.height + 1}`} style={!b.next ? { pointerEvents: "none", opacity: 0.4 } : undefined}>
            Next →
          </Link>
        </div>
      </PageTitle>

      <Card className="mb-6">
        <Row label="Height">{b.height.toLocaleString()}</Row>
        <Row label="Status">
          <span className="chip text-up">{b.confirmations.toLocaleString()} confirmations</span>
        </Row>
        <Row label="Timestamp">
          {date(b.time)} <span className="text-muted">({ago(b.time)})</span>
        </Row>
        <Row label="Mined by">{b.miner ? <HashLink type="address" id={b.miner} full /> : <span className="text-muted">Unknown script</span>}</Row>
        <Row label="Block reward">
          {coin(b.reward)} {symbol}{" "}
          <span className="text-muted">
            ({coin(b.subsidy)} subsidy + {coin(b.fees)} fees)
          </span>
        </Row>
        <Row label="Transactions">{b.ntx.toLocaleString()}</Row>
        <Row label="Difficulty">{difficulty(b.difficulty)}</Row>
        <Row label="Bits / nonce">
          <span className="mono">
            {b.bits} / {b.nonce.toLocaleString()}
          </span>
        </Row>
        <Row label="Size / weight">
          {bytes(b.size)} / {b.weight.toLocaleString()} WU
        </Row>
        <Row label="Version">
          <span className="mono">0x{(b.version >>> 0).toString(16)}</span>
        </Row>
        <Row label="Previous block">{b.prev ? <HashLink type="block" id={b.prev} full /> : <span className="text-muted">Genesis block</span>}</Row>
        <Row label="Next block">{b.next ? <HashLink type="block" id={b.next} full /> : <span className="text-muted">Not mined yet</span>}</Row>
      </Card>

      <Card title={`Transactions (${b.ntx})`}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Transaction</th>
                <th className="text-right">Inputs / outputs</th>
                <th className="text-right">Size</th>
                <th className="text-right">Fee</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.txs.map((t) => (
                <tr key={t.txid}>
                  <td className="text-muted">{t.idx}</td>
                  <td>
                    <HashLink type="tx" id={t.txid} head={16} tail={10} />
                    {t.coinbase ? <span className="chip ml-2 text-[#c99400] dark:text-brand">Coinbase</span> : null}
                  </td>
                  <td className="text-right tabular-nums">
                    {t.coinbase ? "–" : t.nIn} / {t.nOut}
                  </td>
                  <td className="text-right tabular-nums">{t.vsize} vB</td>
                  <td className="text-right tabular-nums text-muted">{t.coinbase ? "–" : coin(t.fee)}</td>
                  <td className="text-right tabular-nums">
                    {coin(t.outTotal, 4)} {symbol}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {b.ntx > PAGE ? (
          <Pager
            label={`${offset + 1}–${Math.min(offset + PAGE, b.ntx)} of ${b.ntx}`}
            onPrev={() => setOffset((v) => Math.max(0, v - PAGE))}
            onNext={() => setOffset((v) => v + PAGE)}
            prevDisabled={offset === 0}
            nextDisabled={offset + PAGE >= b.ntx}
          />
        ) : null}
      </Card>
    </>
  );
}

export default function BlockPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BlockView />
    </Suspense>
  );
}
