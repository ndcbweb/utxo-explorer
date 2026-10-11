# Nadcab UTXO explorer

Block explorer for Bitcoin-style Proof of Work chains launched with [nadcab-coind](https://github.com/ndcbweb/utxo-chain).

- **Server** (`server/`): Fastify API plus a SQLite (`node:sqlite`) indexer that follows the node with `getblock` verbosity 3. It tracks address balances, history, unspent outputs, spent-by links, supply and miners, and rolls back cleanly on reorgs.
- **Web** (`web/`): Next.js + Tailwind static export with light and dark themes. Pages: home (height, hashrate, difficulty, reward and next halving, supply, mempool, charts, top miners), blocks, block, transactions, transaction, address, rich list, mempool, coin rules with the emission schedule, and network (public RPC, address prefixes, how to run a node).

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `RPC_URL` | `http://127.0.0.1:8332` | Node JSON-RPC (needs `-txindex=1`) |
| `RPC_USER` / `RPC_PASS` | | RPC credentials (or `RPC_COOKIE` with a cookie file path) |
| `CHAIN_FILE` | | The chain's `chain.json`, used for coin rules and the emission schedule |
| `CHAIN_NAME` / `CURRENCY_SYMBOL` | from `CHAIN_FILE` | Display name and ticker |
| `PUBLIC_RPC_URL` / `PUBLIC_RPC_USER` / `PUBLIC_RPC_PASS` | | Shown on the Network page |
| `P2P_SEEDS` | | Comma separated `host:port` seed nodes |
| `PORT` | `4200` | HTTP port |
| `DATA_DIR` | `server/.data` | Index database directory |

`GET /api/health` returns `{ ok, indexed, chainHead, syncing }`.

## Release

Every push to `main` builds `explorer.tar.gz`, runs `test/e2e.sh` against a live `nadcab-coind` chain (indexing, balances, supply versus the UTXO set, mempool, search, reorg, restart, static pages) and uploads the bundle to the `latest` release. Hosts run it with:

```sh
docker run -d --network host --env-file explorer.env -v $PWD/explorer:/app -v explorer-data:/data node:22-alpine sh /app/run.sh
```
