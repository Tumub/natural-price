#!/usr/bin/env bash
# One-command deploy to a Docker host over SSH.
#   deploy/deploy.sh user@host            first time and every update
# Needs on the host: Docker with the compose plugin, ports 80 and 443 open,
# and deploy/.env already created there (this script copies it if it exists locally).
set -euo pipefail
target=${1:?usage: deploy/deploy.sh user@host}
dir=/opt/natural-price
here=$(cd "$(dirname "$0")/.." && pwd)

ssh "$target" "mkdir -p $dir"
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude 'packages/extension/dist*' --exclude '*.zip' --exclude deploy/.env \
  "$here/" "$target:$dir/"
if [ -f "$here/deploy/.env" ]; then rsync -az "$here/deploy/.env" "$target:$dir/deploy/.env"; fi
ssh "$target" "cd $dir/deploy && test -f .env || { echo 'deploy/.env missing on host'; exit 1; }"
ssh "$target" "cd $dir/deploy && docker compose build --pull && docker compose up -d --remove-orphans && docker compose ps"
domain=$(ssh "$target" "grep ^NP_DOMAIN= $dir/deploy/.env | cut -d= -f2")
echo "waiting for https://$domain/health"
for i in $(seq 1 30); do
  if curl -fsS "https://$domain/health" >/dev/null 2>&1; then curl -sS "https://$domain/health"; echo; exit 0; fi
  sleep 5
done
echo "health check did not pass in 150 s; see: ssh $target 'cd $dir/deploy && docker compose logs --tail 100'"
exit 1
