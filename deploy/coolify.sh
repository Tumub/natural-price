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
#   NP_ALLOWED_HOSTS   default: ikea.com,mediamarkt.ch,nike.com,booking.com
#   NP_EXITS           default: direct  (name it after the server's country, e.g. de)
#   NP_CROWD_SECRET    default: generated once and kept in Coolify
#   NP_SERVER_UUID     Coolify server to deploy on (default: the first server the token can see)
#   NP_FETCH_MEMORY    memory cap for the fetch service (default 1536M)
#   NP_CROWD_MEMORY    memory cap for the crowd API (default 256M)
#   NP_CONCURRENCY     parallel browser contexts in the fetch service (default 2)
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
# Coolify stores public GitHub repositories as owner/repo and prefixes the host itself.
NP_REPO_SHORT=${NP_REPO#https://github.com/}; NP_REPO_SHORT=${NP_REPO_SHORT%.git}
NP_BRANCH=${NP_BRANCH:-main}
NP_ALLOWED_HOSTS=${NP_ALLOWED_HOSTS:-ikea.com,mediamarkt.ch,nike.com,booking.com}
NP_EXITS=${NP_EXITS:-direct}
NP_FETCH_MEMORY=${NP_FETCH_MEMORY:-1536M}
NP_CROWD_MEMORY=${NP_CROWD_MEMORY:-256M}
NP_CONCURRENCY=${NP_CONCURRENCY:-2}
DRY=${1:-}

for c in curl jq; do command -v "$c" >/dev/null || { echo "need $c"; exit 1; }; done

api() { # method path [json]
  local m=$1 p=$2 body=${3:-}
  if [ "$DRY" = "--dry-run" ] && [ "$m" != GET ]; then
    echo "DRY $m $p ${body:+$(echo "$body" | jq -c .)}" >&2
    echo '{"uuid":"dry-run-uuid"}'
    return
  fi
  local out code
  out=$(curl -sS -X "$m" "$COOLIFY_API_URL$p" -w '\n%{http_code}' \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
    ${body:+--data "$body"})
  code=${out##*$'\n'}; out=${out%$'\n'*}
  if [ "${code:0:1}" != 2 ]; then echo "$m $p -> HTTP $code: $out" >&2; return 1; fi
  echo "$out"
}

echo "server"
servers=$(api GET /servers)
if [ -n "${NP_SERVER_UUID:-}" ]; then
  server_uuid=$(echo "$servers" | jq -r --arg u "$NP_SERVER_UUID" '.[] | select(.uuid==$u) | .uuid')
else
  server_uuid=$(echo "$servers" | jq -r '.[0].uuid')
fi
server_ip=$(echo "$servers" | jq -r --arg u "$server_uuid" '.[] | select(.uuid==$u) | .ip')
[ -n "$server_uuid" ] && [ "$server_uuid" != null ] || { echo "no server visible to this token"; exit 1; }
echo "  $server_uuid ($server_ip)"

echo "project $NP_PROJECT / $NP_ENVIRONMENT"
project_uuid=$(api GET /projects | jq -r --arg n "$NP_PROJECT" '.[] | select(.name==$n) | .uuid')
if [ -z "$project_uuid" ]; then
  project_uuid=$(api POST /projects "$(jq -nc --arg n "$NP_PROJECT" '{name:$n, description:"Natural Price fetch service and crowd API"}')" | jq -r .uuid)
  echo "  created project $project_uuid"
fi
env_uuid=$(api GET "/projects/$project_uuid/environments" 2>/dev/null | jq -r --arg n "$NP_ENVIRONMENT" '.[]? | select(.name==$n) | .uuid' || true)
# Older Coolify: the environment is only addressable by name under the project.
[ -n "$env_uuid" ] || env_uuid=$(api GET "/projects/$project_uuid/$NP_ENVIRONMENT" 2>/dev/null | jq -r '.uuid // empty' || true)
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
    --arg repo "$NP_REPO_SHORT" --arg branch "$NP_BRANCH" --arg name "$name" --arg df "$dockerfile" --arg port "$port" \
    --arg domain "$domain" --arg internal "$internal" --arg memory "$memory" '
    {project_uuid:$project, server_uuid:$server, environment_name:$envn, environment_uuid:$envu,
     git_repository:$repo, git_branch:$branch, build_pack:"dockerfile", dockerfile_location:$df, base_directory:"/",
     ports_exposes:$port, name:$name, instant_deploy:false, connect_to_docker_network:true,
     limits_memory:$memory, health_check_enabled:true, health_check_path:"/health", health_check_port:$port}
    + (if $domain != "" then {domains:("https://"+$domain)} else {autogenerate_domain:false} end)')
  if [ -z "$uuid" ]; then
    uuid=$(api POST /applications/public "$body" | jq -r .uuid)
    [ -n "$uuid" ] && [ "$uuid" != null ] || { echo "  creating $name failed" >&2; exit 1; }
    echo "  created $name $uuid" >&2
  else
    api PATCH "/applications/$uuid" "$(echo "$body" | jq -c 'del(.project_uuid,.server_uuid,.environment_name,.environment_uuid,.instant_deploy,.autogenerate_domain)')" >/dev/null
    echo "  updated $name $uuid" >&2
  fi
  # Newer Coolify accepts a stable internal name and image retention; older builds reject them. Best effort.
  api PATCH "/applications/$uuid" "$(jq -nc --arg i "$internal" '{is_consistent_container_name_enabled:true, custom_internal_name:$i, docker_images_to_keep:2}')" >/dev/null 2>&1 \
    || api PATCH "/applications/$uuid" "$(jq -nc --arg i "$internal" '{custom_network_aliases:$i}')" >/dev/null 2>&1 || true
  echo "$uuid"
}

# The hostname other containers can use for an app: its custom internal name or alias when the server kept it, else its uuid.
internal_host() { # uuid fallback_name
  local app; app=$(api GET "/applications/$1")
  local n; n=$(echo "$app" | jq -r '.custom_internal_name // empty')
  [ -n "$n" ] && { echo "$n"; return; }
  n=$(echo "$app" | jq -r '.custom_network_aliases // empty' | tr ',' '\n' | head -1)
  [ -n "$n" ] && { echo "$n"; return; }
  echo "$1"
}

set_envs() { # uuid KEY=VALUE...
  local uuid=$1; shift
  local existing; existing=$(api GET "/applications/$uuid/envs" | jq -c '[.[] | {key, uuid}]')
  for kv in "$@"; do
    local k=${kv%%=*} v=${kv#*=}
    local old; old=$(echo "$existing" | jq -r --arg k "$k" '.[] | select(.key==$k) | .uuid')
    local body; body=$(jq -nc --arg k "$k" --arg v "$v" '{key:$k, value:$v, is_preview:false, is_literal:true}')
    # Update is by key on this Coolify version; the uuid field is rejected.
    if [ -n "$old" ]; then api PATCH "/applications/$uuid/envs" "$body" >/dev/null
    else api POST "/applications/$uuid/envs" "$body" >/dev/null; fi
  done
}

ensure_volume() { # uuid name mount
  local uuid=$1 name=$2 mount=$3
  # Response shape differs between Coolify versions (flat list or nested); look for any object with this mount path.
  local have; have=$(api GET "/applications/$uuid/storages" | jq -r --arg m "$mount" '[.. | objects | select(.mount_path? == $m)] | length')
  if [ "$have" = 0 ]; then
    api POST "/applications/$uuid/storages" "$(jq -nc --arg n "$name" --arg m "$mount" '{type:"persistent", name:$n, mount_path:$m}')" >/dev/null
    echo "  volume $name -> $mount"
  fi
}

echo "crowd api"
crowd_uuid=$(ensure_app natural-price-crowd /packages/crowd-api/Dockerfile 8788 "" natural-price-crowd "$NP_CROWD_MEMORY" | tail -1)
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
fetch_uuid=$(ensure_app natural-price-fetch /packages/fetch-service/Dockerfile 8787 "$NP_DOMAIN" natural-price-fetch "$NP_FETCH_MEMORY" | tail -1)
ensure_volume "$fetch_uuid" natural-price-fetch-data /data
set_envs "$fetch_uuid" PORT=8787 "NP_ALLOWED_HOSTS=$NP_ALLOWED_HOSTS" "NP_EXITS=$NP_EXITS" NP_FETCHES_PER_CHECK=1 "NP_CONCURRENCY=$NP_CONCURRENCY" \
  "NP_CROWD_URL=http://$(internal_host "$crowd_uuid" natural-price-crowd):8788" NP_STATS_FILE=/data/stats.json

echo "deploy"
api POST "/deploy?uuid=$crowd_uuid,$fetch_uuid" | jq -c '.deployments? // .'

[ "$DRY" = "--dry-run" ] && exit 0
echo "waiting for https://$NP_DOMAIN/health"
for i in $(seq 1 60); do
  if out=$(curl -fsS --max-time 10 "https://$NP_DOMAIN/health" 2>/dev/null); then echo "$out"; echo "done. set the GitHub variable NP_SERVICE_URL=https://$NP_DOMAIN and tag a release."; exit 0; fi
  sleep 10
done
echo "not healthy after 10 minutes; check the deployment logs in Coolify"; exit 1
