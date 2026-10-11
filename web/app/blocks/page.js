"use client";

import { useState } from "react";
import { useChain } from "@/components/Shell";
import { Card, Empty, HashLink, PageTitle, Pager } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, bytes, coin, difficulty } from "@/lib/format";

export default function Blocks() {
  const { info } = useChain();
  const [cursors, setCursors] = useState([]);
  const before = cursors[cursors.length - 1];
  const { data, loading, error } = useApi(`/blocks?limit=25${before != null ? `&before=${before}` : ""}`, { refreshMs: before == null ? 8000 : 0 });
  const blocks = data?.blocks || [];

  return (
    <>
      <PageTitle title="Blocks" sub={data ? `${(data.tip + 1).toLocaleString()} blocks indexed` : ""} />
      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Height</th>
                <th>Hash</th>
                <th>Age</th>
                <th>Miner</th>
                <th className="text-right">Txs</th>
                <th className="text-right">Size</th>
                <th className="text-right">Difficulty</th>
                <th className="text-right">Reward</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.hash}>
                  <td>
                    <HashLink type="block" id={String(b.height)} label={b.height.toLocaleString()} />
                  </td>
                  <td>
                    <HashLink type="block" id={b.hash} head={10} tail={8} />
                  </td>
                  <td className="text-muted">{ago(b.time)}</td>
                  <td>
                    <HashLink type="address" id={b.miner} head={8} tail={6} />
                  </td>
                  <td className="text-right tabular-nums">{b.ntx}</td>
                  <td className="text-right tabular-nums">{bytes(b.size)}</td>
                  <td className="text-right tabular-nums">{difficulty(b.difficulty)}</td>
                  <td className="text-right tabular-nums">
                    {coin(b.reward, 4)} {info?.symbol}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!blocks.length ? <Empty>{loading ? "Loading…" : error || "No blocks yet"}</Empty> : null}
        <Pager
          onPrev={() => setCursors((list) => list.slice(0, -1))}
          onNext={() => setCursors((list) => [...list, blocks[blocks.length - 1].height])}
          prevDisabled={!cursors.length}
          nextDisabled={!blocks.length || blocks[blocks.length - 1].height === 0}
        />
      </Card>
    </>
  );
}
