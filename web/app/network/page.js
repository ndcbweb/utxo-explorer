"use client";

import { useChain } from "@/components/Shell";
import { Card, Copy, Loading, PageTitle, Row } from "@/components/ui";
import { bytes } from "@/lib/format";

function Code({ children }) {
  return (
    <div className="relative">
      <pre className="mono overflow-x-auto rounded-xl bg-black/5 p-4 pr-10 text-xs leading-relaxed dark:bg-black/40">{children}</pre>
      <div className="absolute right-2 top-2">
        <Copy text={children} />
      </div>
    </div>
  );
}

export default function Network() {
  const { info } = useChain();
  if (!info) return <Loading />;
  const r = info.rules;
  const rpc = info.publicRpc;
  const auth = rpc.user ? `--user '${rpc.user}:${rpc.pass}' ` : "";

  return (
    <>
      <PageTitle title="Network" sub="Connect a node, wallet or app to this chain" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Node">
          <Row label="Client">{info.node?.version?.replace(/\//g, "") || "nadcab-coind"}</Row>
          <Row label="Peers">{info.node?.peers ?? "–"}</Row>
          <Row label="P2P port">{r.port ?? "–"}</Row>
          <Row label="Network magic">
            <span className="mono">{r.messageStart || "–"}</span>
          </Row>
          <Row label="Chain data">{info.node ? bytes(info.node.sizeOnDisk) : "–"}</Row>
          <Row label="Seed nodes">
            {info.seeds.length ? (
              info.seeds.map((seed) => (
                <div key={seed} className="mono flex items-center gap-1">
                  {seed} <Copy text={seed} />
                </div>
              ))
            ) : (
              <span className="text-muted">Not published</span>
            )}
          </Row>
        </Card>
        <Card title="Addresses">
          <Row label="SegWit (Bech32) prefix">
            <span className="mono">{r.bech32 ? `${r.bech32}1…` : "–"}</span>
          </Row>
          <Row label="Legacy address version">{r.base58?.pubkey ?? "–"}</Row>
          <Row label="Script address version">{r.base58?.script ?? "–"}</Row>
          <Row label="Private key (WIF) version">{r.base58?.secret ?? "–"}</Row>
          <Row label="Extended keys">
            <span className="mono">
              {r.base58?.extPublic || "–"} / {r.base58?.extSecret || "–"}
            </span>
          </Row>
        </Card>
      </div>

      {rpc.url ? (
        <Card title="Public JSON-RPC" className="mt-3" bodyClass="space-y-4 px-5 pb-5">
          <p className="text-sm text-muted">
            Read-only Bitcoin-style JSON-RPC. Wallet, mining and node control methods are disabled on the public endpoint.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["URL", rpc.url],
              ["User", rpc.user || "–"],
              ["Password", rpc.pass || "–"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-black/5 px-4 py-3 dark:bg-white/5">
                <div className="label">{label}</div>
                <div className="mono mt-1 flex items-center gap-1 break-all">
                  {value}
                  {value !== "–" ? <Copy text={value} /> : null}
                </div>
              </div>
            ))}
          </div>
          <Code>{`curl -s ${auth}-H 'content-type: application/json' \\
  -d '{"jsonrpc":"1.0","id":1,"method":"getblockchaininfo","params":[]}' \\
  ${rpc.url}`}</Code>
        </Card>
      ) : null}

      {r.port && info.seeds.length ? (
        <Card title="Run your own node" className="mt-3" bodyClass="space-y-3 px-5 pb-5">
          <p className="text-sm text-muted">Download the chain file, then start nadcab-coind with it and point it at a seed node.</p>
          <Code>{`docker run -d --name node -p ${r.port}:${r.port} -v $PWD/chain.json:/chain.json -v node-data:/data \\
  nadcab/utxo-chain:latest -chainjson=/chain.json -datadir=/data \\
  ${info.seeds.map((seed) => `-addnode=${seed}`).join(" ")}`}</Code>
        </Card>
      ) : null}
    </>
  );
}
