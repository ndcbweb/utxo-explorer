#!/bin/bash
# Runs the explorer against a real nadcab-coind chain: indexing, balances, supply, mempool, search, reorg, static pages.
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE="${IMAGE:-nadcab/utxo-chain:latest}"
WORK="$(mktemp -d)"
EXPLORER_PID=""
cleanup() {
  [ -n "$EXPLORER_PID" ] && kill "$EXPLORER_PID" 2>/dev/null || true
  docker rm -f e2e-node >/dev/null 2>&1 || true
}
trap cleanup EXIT
fail() {
  echo "FAIL: $*" >&2
  [ -f "$WORK/explorer.log" ] && tail -40 "$WORK/explorer.log" >&2
  exit 1
}

cat > "$WORK/chain.json" <<'JSON'
{
  "name": "Explorer Test", "ticker": "EXT", "algorithm": "sha256d",
  "messageStart": "e1e2e3e4", "port": 39555, "bech32": "ext",
  "base58": { "pubkey": 33, "script": 5, "secret": 161, "extPublic": "0488b21e", "extSecret": "0488ade4" },
  "blockSpacing": 120, "retargetInterval": 500,
  "powLimit": "7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "genesis": { "time": 1760000000, "bits": "207fffff", "message": "Explorer e2e" },
  "subsidy": { "initial": "5000000000", "halvingInterval": 25, "maxHalvings": 64, "reductionPercent": 50, "tail": "0", "premine": "250000000000" }
}
JSON
docker run --rm -v "$WORK:/chain" --entrypoint nadcab-genesis "$IMAGE" /chain/chain.json >/dev/null
mkdir -p "$WORK/data"
docker run -d --name e2e-node --network host -v "$WORK:/chain" -v "$WORK/data:/data" "$IMAGE" \
  -datadir=/data -chainjson=/chain/chain.json -port=39555 -rpcport=39554 -rpcbind=127.0.0.1 -rpcallowip=127.0.0.1 \
  -rpcuser=explorer -rpcpassword=e2e-secret -txindex=1 -fallbackfee=0.0001 -listen=0 -dnsseed=0 >/dev/null
cli() { docker exec e2e-node nadcab-coin-cli -datadir=/data -rpcport=39554 -rpcuser=explorer -rpcpassword=e2e-secret "$@"; }
for _ in $(seq 1 60); do cli getblockcount >/dev/null 2>&1 && break; sleep 1; done

cli createwallet w >/dev/null
MINER="$(cli getnewaddress '' bech32)"
LEGACY="$(cli getnewaddress '' legacy)"
OTHER="$(cli getnewaddress '' bech32m)"
cli generatetoaddress 120 "$MINER" >/dev/null
SEND1="$(cli sendtoaddress "$LEGACY" 12.5)"
SEND2="$(cli sendtoaddress "$OTHER" 3.25)"
cli generatetoaddress 1 "$MINER" >/dev/null
INPUT="$(cli listunspent 1 9999 "[\"$LEGACY\"]" | jq -c '[.[0] | {txid, vout}]')"
SPEND="$(cli -named send outputs="{\"$MINER\": 1}" options="{\"inputs\": $INPUT, \"change_address\": \"$LEGACY\"}" | jq -r .txid)"
cli generatetoaddress 1 "$MINER" >/dev/null
POOL="$(cli sendtoaddress "$OTHER" 1.5)"

export PORT=4290 DATA_DIR="$WORK/explorer" WEB_DIR="$PWD/web/out" CHAIN_FILE="$WORK/chain.json" POLL_MS=1000
export RPC_URL=http://127.0.0.1:39554 RPC_USER=explorer RPC_PASS=e2e-secret PUBLIC_RPC_URL=https://rpc.example.com PUBLIC_RPC_USER=public PUBLIC_RPC_PASS=pw
(cd server && node --experimental-sqlite --no-warnings src/index.js >"$WORK/explorer.log" 2>&1) &
EXPLORER_PID=$!
API=http://127.0.0.1:$PORT/api

wait_synced() {
  local head
  head="$(cli getblockcount)"
  for _ in $(seq 1 90); do
    [ "$(curl -fs "$API/health" | jq -r '"\(.indexed)/\(.chainHead)"')" = "$head/$head" ] && return
    sleep 1
  done
  fail "explorer did not index to $head: $(curl -s "$API/health")"
}
sats() { python3 -c "from decimal import Decimal; print(int(Decimal('$1') * 100000000))"; }
check_supply() {
  local want got
  want="$(sats "$(cli gettxoutsetinfo none | jq -r .total_amount)")"
  got="$(curl -fs "$API/info" | jq -r .supply)"
  [ "$want" = "$got" ] || fail "supply $got, node UTXO set holds $want"
  echo "supply ok: $got"
}
expect() { # description jq-filter url
  curl -fs "$3" | jq -e "$2" >/dev/null || fail "$1: $(curl -s "$3" | head -c 600)"
  echo "ok: $1"
}

wait_synced
check_supply
expect "info reports rules and max supply" '.rules.algorithm=="sha256d" and .rules.subsidy.premine=="250000000000" and .rules.maxSupply != null and .publicRpc.user=="public"' "$API/info"
expect "premine in block 1" '.block.reward=="250000000000" and .block.subsidy=="250000000000"' "$API/block/1"
expect "halving at 25" '.block.subsidy=="2500000000"' "$API/block/25"
expect "genesis block" '.block.height==0 and .block.prev==null' "$API/block/0"
expect "legacy address balance after spend" ".summary.txs==2 and (.summary.balance|tonumber) < 1250000000 and (.summary.balance|tonumber) > 1100000000 and .type==\"Legacy\"" "$API/address/$LEGACY"
expect "taproot address" '.summary.balance=="325000000" and .type=="Taproot"' "$API/address/$OTHER"
expect "spent output links to spender" "[.tx.vout[] | select(.address==\"$LEGACY\") | .spent.txid] | index(\"$SPEND\") != null" "$API/tx/$SEND1"
expect "tx inputs carry prevout values" '.tx.fee != null and (.tx.vin[0].value|tonumber) > 0' "$API/tx/$SPEND"
expect "mempool shows pending tx" ".info.count==1 and .txs[0].txid==\"$POOL\"" "$API/mempool"
expect "unconfirmed tx" '.tx.confirmations==0' "$API/tx/$POOL"
expect "rich list ordered" '(.accounts | length) >= 3 and ((.accounts[0].balance|tonumber) >= (.accounts[1].balance|tonumber))' "$API/richlist"
expect "blocks paging" '(.blocks | length)==10 and .blocks[0].height==111' "$API/blocks?limit=10&before=112"
expect "charts" '(.blocks | length) > 100 and .miners[0].miner != null' "$API/charts"
expect "search height" '.type=="block"' "$API/search?q=5"
expect "search tx" '.type=="tx"' "$API/search?q=$SEND1"
expect "search address" '.type=="address"' "$API/search?q=$LEGACY"
code="$(curl -s -o /dev/null -w '%{http_code}' "$API/search?q=nope")"; [ "$code" = 404 ] || fail "bad search returned $code"

echo "== reorg"
TIP="$(cli getblockcount)"
cli invalidateblock "$(cli getblockhash $((TIP - 1)))"
cli generatetoaddress 3 "$OTHER" >/dev/null
wait_synced
[ "$(curl -fs "$API/block/$TIP" | jq -r .block.hash)" = "$(cli getblockhash "$TIP")" ] || fail "reorged block hash"
check_supply
echo "reorg ok"

echo "== restart keeps the index"
kill "$EXPLORER_PID"; wait "$EXPLORER_PID" 2>/dev/null || true
(cd server && node --experimental-sqlite --no-warnings src/index.js >>"$WORK/explorer.log" 2>&1) &
EXPLORER_PID=$!
sleep 2
cli generatetoaddress 2 "$MINER" >/dev/null
wait_synced
check_supply

echo "== static pages"
for path in / /blocks/ /block/?id=1 /tx/?id=$SEND1 /address/?id=$LEGACY /richlist/ /mempool/ /rules/ /network/ /txs/; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$path")"
  [ "$code" = 200 ] || fail "GET $path returned $code"
done
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/blocks")"
[ "$code" = 301 ] || [ "$code" = 302 ] || [ "$code" = 200 ] || fail "GET /blocks returned $code"
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/nope/")"
[ "$code" = 404 ] || fail "unknown page returned $code"
echo "static ok"
echo "ALL EXPLORER CHECKS PASSED"
