#!/usr/bin/env bash
# Create or update both Natural Price services as Coolify applications and deploy them.
#
#   COOLIFY_API_URL    e.g. https://coolify.example/api/v1
#   COOLIFY_API_TOKEN  API token with write scope (environment only, never a file in this repo)
#   NP_DOMAIN          hostname for the fetch service, A record already pointing at the Coolify host
#   NP_PROJECT         Coolify project name to use or create (default: natural-price)
#   NP_ENVIRONMENT     environment name inside the project (default: production)
#   NP_REPO            git repository (default: https://github.com/Tumub/natural-price)
#   NP_BRANCH          branch (default: main)
#   NP_ALLOWED_HOSTS   default: ikea.com,mediamarkt.ch,nike.com
#   NP_EXITS           default: direct  (name it after the server's country, e.g. de)
#   NP_CROWD_SECRET    default: generated once and printed, keep it
#
#   deploy/coolify.sh            create what is missing, update variables, deploy both
#   deploy/coolify.sh --dry-run  print every request without sending
set -euo pipefail

: "${COOLIFY_API_URL:?set COOLIFY_API_URL}"
: "${COOLIFY_API_TOKEN:?set COOLIFY_API_TOKEN}"
: "${NP_DOMAIN:?set NP_DOMAIN}"
NP_PROJECT=${NP_PROJECT:-natural-price}
NP_ENVIRONMENT=${NP_ENVIRONMENT:-production}
NP_REPO=${NP_REPO:-https://github.com/Tumub/natural-price}
NP_BRANCH=${NP_BRANCH:-main}
NP_ALLOWED_HOSTS=${NP_ALLOWED_HOSTS:-ikea.com,mediamarkt.ch,nike.com}
NP_EXITS=${NP_EXITS:-direct}
DRY=${1:-}

for c in curl jq; do command -v "$c" >/dev/null || { echo "need $c"; exit 1; }; done

api() { # method path [json]
  local m=$1 p=$2 body=${3:-}
  if [ "$DRY" = "--dry-run" ] && [ "$m" != GET ]; then
    echo "DRY $m $p ${body:+$(echo "$body" | jq -c .)}" >&2
    echo '{"uuid":"dry-run-uuid"}'
    return
  fi
  curl -sS -f -X "$m" "$COOLIFY_API_URL$p" \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
    ${body:+--data "$body"}
}

echo "server"
server_uuid=$(api GET /servers | jq -r '.[0].uuid')
server_ip=$(api GET /servers | jq -r '.[0].ip')
[ -n "$server_uuid" ] && [ "$server_uuid" != null ] || { echo "no server visible to this token"; exit 1; }
echo "  $server_uuid ($server_ip)"

echo "project $NP_PROJECT / $NP_ENVIRONMENT"
project_uuid=$(api GET /projects | jq -r --arg n "$NP_PROJECT" '.[] | select(.name==$n) | .uuid')
if [ -z "$project_uuid" ]; then
  project_uuid=$(api POST /projects "$(jq -nc --arg n "$NP_PROJECT" '{name:$n, description:"Natural Price: fetch service and crowd API"}')" | jq -r .uuid)
  echo "  created project $project_uuid"
fi
env_uuid=$(api GET "/projects/$project_uuid/environments" 2>/dev/null | jq -r --arg n "$NP_ENVIRONMENT" '.[]? | select(.name==$n) | .uuid' || true)
if [ -z "$env_uuid" ]; then
  env_uuid=$(api POST "/projects/$project_uuid/environments" "$(jq -nc --arg n "$NP_ENVIRONMENT" '{name:$n}')" | jq -r .uuid)
  echo "  created environment $env_uuid"
fi

find_app() { api GET /applications | jq -r --arg n "$1" '.[] | select(.name==$n) | .uuid'; }

ensure_app() { # name dockerfile_location port domain internal_name memory
  local name=$1 dockerfile=$2 port=$3 domain=$4 internal=$5 memory=$6
  local uuid; uuid=$(find_app "$name")
  local body; body=$(jq -nc \
    --arg project "$project_uuid" --arg server "$server_uuid" --arg envn "$NP_ENVIRONMENT" --arg envu "$env_uuid" \
    --arg repo "$NP_REPO" --arg branch "$NP_BRANCH" --arg name "$name" --arg df "$dockerfile" --arg port "$port" \
    --arg domain "$domain" --arg internal "$internal" --arg memory "$memory" '
    {project_uuid:$project, server_uuid:$server, environment_name:$envn, environment_uuid:$envu,
     git_repository:$repo, git_branch:$branch, build_pack:"dockerfile", dockerfile_location:$df, base_directory:"/",
     ports_exposes:$port, name:$name, instant_deploy:false,
     connect_to_docker_network:true, is_consistent_container_name_enabled:true, custom_internal_name:$internal,
     limits_memory:$memory, health_check_enabled:true, health_check_path:"/health", health_check_port:$port,
     is_git_shallow_clone_enabled:true, docker_images_to_keep:2}
    + (if $domain != "" then {domains:("https://"+$domain)} else {autogenerate_domain:false} end)')
  if [ -z "$uuid" ]; then
    uuid=$(api POST /applications/public "$body" | jq -r .uuid)
    echo "  created $name $uuid" >&2
  else
    api PATCH "/applications/$uuid" "$(echo "$body" | jq -c 'del(.project_uuid,.server_uuid,.environment_name,.environment_uuid,.instant_deploy)')" >/dev/null
    echo "  updated $name $uuid" >&2
  fi
  echo "$uuid"
}

set_envs() { # uuid KEY=VALUE...
  local uuid=$1; shift
  local existing; existing=$(api GET "/applications/$uuid/envs" | jq -c '[.[] | {key, uuid}]')
  for kv in "$@"; do
    local k=${kv%%=*} v=${kv#*=}
    local old; old=$(echo "$existing" | jq -r --arg k "$k" '.[] | select(.key==$k) | .uuid')
    local body; body=$(jq -nc --arg k "$k" --arg v "$v" '{key:$k, value:$v, is_preview:false, is_literal:true}')
    if [ -n "$old" ]; then api PATCH "/applications/$uuid/envs" "$(echo "$body" | jq -c --arg u "$old" '. + {uuid:$u}')" >/dev/null
    else api POST "/applications/$uuid/envs" "$body" >/dev/null; fi
  done
}

ensure_volume() { # uuid name mount
  local uuid=$1 name=$2 mount=$3
  local have; have=$(api GET "/applications/$uuid/storages" | jq -r --arg m "$mount" '.[]? | select(.mount_path==$m) | .uuid')
  if [ -z "$have" ]; then
    api POST "/applications/$uuid/storages" "$(jq -nc --arg n "$name" --arg m "$mount" '{type:"persistent", name:$n, mount_path:$m}')" >/dev/null
    echo "  volume $name -> $mount"
  fi
}

echo "crowd api"
crowd_uuid=$(ensure_app natural-price-crowd packages/crowd-api/Dockerfile 8788 "" natural-price-crowd 256M | tail -1)
if [ -z "${NP_CROWD_SECRET:-}" ]; then
  NP_CROWD_SECRET=$(api GET "/applications/$crowd_uuid/envs" | jq -r '.[]? | select(.key=="NP_CROWD_SECRET") | .value' | head -1)
  if [ -z "$NP_CROWD_SECRET" ] || [ "$NP_CROWD_SECRET" = null ]; then
    NP_CROWD_SECRET=$(openssl rand -hex 32)
    echo "  generated NP_CROWD_SECRET (kept in Coolify; back it up with the database)"
  fi
fi
ensure_volume "$crowd_uuid" natural-price-crowd-data /data
set_envs "$crowd_uuid" PORT=8788 NP_CROWD_DB=/data/crowd.sqlite "NP_CROWD_SECRET=$NP_CROWD_SECRET" "NP_ALLOWED_HOSTS=$NP_ALLOWED_HOSTS"

echo "fetch service"
fetch_uuid=$(ensure_app natural-price-fetch packages/fetch-service/Dockerfile 8787 "$NP_DOMAIN" natural-price-fetch 1536M | tail -1)
ensure_volume "$fetch_uuid" natural-price-fetch-data /data
set_envs "$fetch_uuid" PORT=8787 "NP_ALLOWED_HOSTS=$NP_ALLOWED_HOSTS" "NP_EXITS=$NP_EXITS" NP_FETCHES_PER_CHECK=1 NP_CONCURRENCY=2 \
  NP_CROWD_URL=http://natural-price-crowd:8788 NP_STATS_FILE=/data/stats.json

echo "deploy"
api POST "/deploy?uuid=$crowd_uuid,$fetch_uuid" | jq -c '.deployments? // .'

[ "$DRY" = "--dry-run" ] && exit 0
echo "waiting for https://$NP_DOMAIN/health"
for i in $(seq 1 60); do
  if out=$(curl -fsS --max-time 10 "https://$NP_DOMAIN/health" 2>/dev/null); then echo "$out"; echo "done. set the GitHub variable NP_SERVICE_URL=https://$NP_DOMAIN and tag a release."; exit 0; fi
  sleep 10
done
echo "not healthy after 10 minutes; check the deployment logs in Coolify"; exit 1
