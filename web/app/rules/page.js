"use client";

import { useChain } from "@/components/Shell";
import { Card, Loading, PageTitle, Row, Spark } from "@/components/ui";
import { ALGORITHM_LABEL, coin, coinCompact, date, duration } from "@/lib/format";

function subsidyAt(height, s) {
  if (height === 1 && s.premine > 0n) return s.premine;
  const steps = Math.min(s.interval > 0 ? Math.floor(height / s.interval) : 0, s.maxSteps);
  let value = s.initial;
  if (s.percent === 50) value = steps >= 64 ? 0n : value >> BigInt(steps);
  else {
    const keep = BigInt(100 - s.percent);
    for (let i = 0; i < steps && value > 0n; i += 1) value = (value / 100n) * keep + ((value % 100n) * keep) / 100n;
  }
  return value > s.tail ? value : s.tail;
}

function schedule(s, limit = 40) {
  const rows = [];
  let mined = s.premine > 0n ? s.premine - subsidyAt(2, s) : 0n;
  for (let step = 0; step <= Math.min(s.maxSteps, 400) && rows.length < limit; step += 1) {
    const start = step * s.interval;
    const reward = subsidyAt(Math.max(start, 2), s);
    const blocks = BigInt(step === 0 ? s.interval - 1 : s.interval);
    if (step === s.maxSteps || reward === 0n) {
      rows.push({ step, start, reward, mined, final: true });
      break;
    }
    mined += reward * blocks;
    if (rows.length && rows[rows.length - 1].reward === reward) {
      rows[rows.length - 1].mined = mined;
      continue;
    }
    rows.push({ step, start, reward, mined });
  }
  return rows;
}

export default function Rules() {
  const { info } = useChain();
  if (!info) return <Loading />;
  const r = info.rules;
  const symbol = info.symbol;
  const s = Object.fromEntries(Object.entries(r.subsidy).map(([k, v]) => [k, ["initial", "tail", "premine"].includes(k) ? BigInt(v) : Number(v)]));
  const rows = schedule(s);
  const height = info.node?.height ?? info.index.chainHead;
  const currentStep = s.interval > 0 ? Math.floor(height / s.interval) : 0;
  const reduction = s.percent === 50 ? "Halving" : `${s.percent}% cut`;

  return (
    <>
      <PageTitle title="Coin rules" sub="Consensus parameters every node on this network enforces" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Consensus">
          <Row label="Proof of Work">{ALGORITHM_LABEL[r.algorithm] || r.algorithm}</Row>
          <Row label="Target block time">{duration(r.blockSpacing)}</Row>
          <Row label="Difficulty retarget">
            Every {r.retargetInterval.toLocaleString()} blocks (≈ {duration(r.retargetInterval * r.blockSpacing)})
          </Row>
          <Row label="SegWit / Taproot">Active from the genesis block</Row>
          {r.genesis ? (
            <>
              <Row label="Genesis date">{date(r.genesis.time)}</Row>
              <Row label="Genesis message">
                <span className="italic">“{r.genesis.message}”</span>
              </Row>
            </>
          ) : null}
        </Card>
        <Card title="Emission">
          <Row label="Initial block reward">
            {coin(s.initial)} {symbol}
          </Row>
          <Row label="Reward change">
            {reduction} every {s.interval.toLocaleString()} blocks (≈ {duration(s.interval * r.blockSpacing)})
          </Row>
          <Row label="Reductions">Up to {s.maxSteps.toLocaleString()}</Row>
          <Row label="Tail reward">{s.tail > 0n ? `${coin(s.tail)} ${symbol} per block forever` : "None"}</Row>
          <Row label="Premine">{s.premine > 0n ? `${coin(s.premine)} ${symbol} in block 1` : "None"}</Row>
          <Row label="Max supply">{r.maxSupply ? `${coin(r.maxSupply)} ${symbol}` : "Uncapped (tail emission)"}</Row>
          <Row label="Mined so far">
            {coin(info.supply, 2)} {symbol}
          </Row>
        </Card>
      </div>

      <Card title="Emission schedule" className="mt-3" action={<span className="text-xs text-muted">Coins in circulation at the end of each era</span>}>
        <div className="px-2 pb-2">
          <Spark values={rows.map((row) => Number(row.mined / 100_000_000n))} height={120} />
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Era</th>
                <th>From block</th>
                <th>Starts around</th>
                <th className="text-right">Reward per block</th>
                <th className="text-right">Supply at era end</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const live = row.step <= currentStep && (rows.find((x) => x.step > row.step)?.step ?? Infinity) > currentStep;
                const eta = (row.start - height) * r.blockSpacing;
                return (
                  <tr key={row.step} className={live ? "bg-brand/10" : ""}>
                    <td>
                      {row.step + 1}
                      {live ? <span className="chip ml-2 text-[#c99400] dark:text-brand">Now</span> : null}
                    </td>
                    <td className="tabular-nums">{row.start.toLocaleString()}</td>
                    <td className="text-muted">{eta > 0 ? `in ${duration(eta)}` : "started"}</td>
                    <td className="text-right tabular-nums">
                      {coin(row.reward)} {symbol}
                    </td>
                    <td className="text-right tabular-nums">{row.final ? (row.reward > 0n ? "keeps growing" : `${coinCompact(row.mined)} ${symbol}`) : `${coinCompact(row.mined)} ${symbol}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
