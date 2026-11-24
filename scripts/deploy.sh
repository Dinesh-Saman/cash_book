#!/usr/bin/env bash
# Deploy a vMAJOR.MINOR.PATCH tag to this server.
# Invoked by the restricted GitHub Actions SSH key, or locally with the tag as $1.
set -euo pipefail

# Re-exec from a copy so a later git checkout cannot change this script mid-run.
if [[ -z "${DEPLOY_SCRIPT_COPIED:-}" ]]; then
  tmp="$(mktemp)"
  cp "$0" "$tmp"
  chmod 700 "$tmp"
  export DEPLOY_SCRIPT_COPIED=1
  exec /usr/bin/bash "$tmp" "$@"
fi

export PATH="/usr/bin:/bin:${PATH:-}"

TAG="${1:-${SSH_ORIGINAL_COMMAND:-}}"
# Trim surrounding whitespace. Do not evaluate the value.
TAG="${TAG#"${TAG%%[![:space:]]*}"}"
TAG="${TAG%"${TAG##*[![:space:]]}"}"

if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Refusing to deploy '${TAG}'. Expected a tag like v0.1.0." >&2
  exit 1
fi

REPO="/var/www/kassenbuch.nrwsystem.de"
cd "$REPO"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Refusing to deploy." >&2
  git status --porcelain >&2
  exit 1
fi

echo "Deploying ${TAG}"
git fetch origin tag "$TAG" --force
git checkout --detach "$TAG"

# Dev dependencies are required to build. Ignore a production NODE_ENV from the caller.
env -u NODE_ENV npm ci --prefix frontend
env -u NODE_ENV npm run build --prefix frontend
env -u NODE_ENV npm ci --prefix backend
env -u NODE_ENV npm run build --prefix backend

sudo systemctl restart kassenbuch

health=""
for _ in $(seq 1 30); do
  if health="$(curl -fsS http://127.0.0.1:5000/api/health 2>/dev/null || true)" \
    && [[ "$health" == *'"dbState":1'* ]]; then
    printf '%s\n' "$health"
    exit 0
  fi
  sleep 1
done

echo "Health check failed: ${health:-no response}" >&2
exit 1
