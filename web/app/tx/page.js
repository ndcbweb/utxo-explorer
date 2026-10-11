"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useChain } from "@/components/Shell";
import { Card, Copy, ErrorBox, HashLink, Loading, PageTitle, Row } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, coin, date } from "@/lib/format";

const TYPE_LABEL = {
  witness_v0_keyhash: "P2WPKH",
  witness_v0_scripthash: "P2WSH",
  witness_v1_taproot: "P2TR",
  pubkeyhash: "P2PKH",
  scripthash: "P2SH",
  pubkey: "P2PK",
  nulldata: "OP_RETURN",
  multisig: "Multisig",
};

function TxView() {
  const id = useSearchParams().get("id") || "";
  const { info } = useChain();
  const { data, error, loading } = useApi(id ? `/tx/${encodeURIComponent(id)}` : null, { refreshMs: 15_000 });
  const symbol = info?.symbol || "";

  if (!id) return <ErrorBox message="No transaction selected" />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} />;
  const tx = data.tx;
  const outTotal = tx.vout.reduce((sum, o) => sum + BigInt(o.value ?? 0), 0n);
  const inTotal = tx.vin.reduce((sum, i) => sum + BigInt(i.value ?? 0), 0n);
  const confirmed = tx.confirmations > 0;

  return (
    <>
      <PageTitle
        title="Transaction"
        sub={
          <>
            <span className="mono truncate">{tx.txid}</span>
            <Copy text={tx.txid} />
          </>
        }
      />
      <Card className="mb-6">
        <Row label="Status">
          {confirmed ? (
            <span className="chip text-up">{tx.confirmations.toLocaleString()} confirmations</span>
          ) : (
            <span className="chip text-[#c99400] dark:text-brand">In mempool, waiting for a miner</span>
          )}
        </Row>
        {confirmed ? (
          <Row label="Block">
            <HashLink type="block" id={tx.blockhash} label={tx.height != null ? `#${tx.height.toLocaleString()}` : undefined} />
          </Row>
        ) : null}
        <Row label="Time">
          {date(tx.time)} <span className="text-muted">({ago(tx.time)})</span>
        </Row>
        <Row label="Total output">
          {coin(outTotal)} {symbol}
        </Row>
        <Row label="Fee">
          {tx.coinbase ? (
            <span className="text-muted">Coinbase, creates new coins</span>
          ) : (
            <>
              {coin(tx.fee ?? inTotal - outTotal)} {symbol}{" "}
              <span className="text-muted">
                ({(Number(BigInt(tx.fee ?? inTotal - outTotal)) / tx.vsize).toFixed(2)} sat/vB)
              </span>
            </>
          )}
        </Row>
        <Row label="Size">
          {tx.size.toLocaleString()} B · {tx.vsize.toLocaleString()} vB · {tx.weight.toLocaleString()} WU
        </Row>
        <Row label="Version / locktime">
          {tx.version} / {tx.locktime}
        </Row>
        {tx.hash !== tx.txid ? (
          <Row label="Witness hash">
            <span className="mono">{tx.hash}</span>
          </Row>
        ) : null}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={`Inputs (${tx.vin.length})`}>
          <ul>
            {tx.vin.map((input, i) => (
              <li key={i} className="border-t border-black/5 px-5 py-3 text-sm dark:border-white/5">
                {input.coinbase ? (
                  <div>
                    <div className="font-medium text-[#c99400] dark:text-brand">Newly mined coins</div>
                    <div className="mono mt-1 truncate text-xs text-muted">{input.coinbase}</div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {input.address ? <HashLink type="address" id={input.address} head={14} tail={10} /> : <span className="text-muted">Non-standard</span>}
                      <div className="mt-1 text-xs text-muted">
                        <HashLink type="tx" id={input.txid} head={8} tail={4} />:{input.vout}
                        {input.type ? ` · ${TYPE_LABEL[input.type] || input.type}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums">
                      {coin(input.value)} {symbol}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`Outputs (${tx.vout.length})`}>
          <ul>
            {tx.vout.map((output) => (
              <li key={output.n} className="border-t border-black/5 px-5 py-3 text-sm dark:border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {output.address ? (
                      <HashLink type="address" id={output.address} head={14} tail={10} />
                    ) : output.type === "nulldata" ? (
                      <span className="mono break-all text-xs text-muted">{output.asm}</span>
                    ) : (
                      <span className="text-muted">Non-standard script</span>
                    )}
                    <div className="mt-1 text-xs text-muted">
                      #{output.n} · {TYPE_LABEL[output.type] || output.type} ·{" "}
                      {output.spent ? (
                        <>
                          spent in <HashLink type="tx" id={output.spent.txid} head={8} tail={4} />
                        </>
                      ) : output.type === "nulldata" ? (
                        "unspendable"
                      ) : (
                        <span className="text-up">unspent</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {coin(output.value)} {symbol}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export default function TxPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TxView />
    </Suspense>
  );
}
