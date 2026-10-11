#!/usr/bin/env bash
# Builds dist/explorer.tar.gz, which explorer hosts download and run with node:22-alpine.
set -euo pipefail
cd "$(dirname "$0")/.."

(cd web && npm ci && NODE_ENV=production npm run build)
(cd server && npm ci --omit=dev)

rm -rf dist
mkdir -p dist/explorer/web
cp -R server dist/explorer/server
rm -rf dist/explorer/server/.data
cp -R web/out dist/explorer/web/out
cp run.sh dist/explorer/run.sh
tar -czf dist/explorer.tar.gz -C dist explorer
echo "Built $(pwd)/dist/explorer.tar.gz"
