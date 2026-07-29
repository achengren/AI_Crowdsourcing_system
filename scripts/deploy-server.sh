#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/hib-course-management}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
npm ci
npm run test
npm run build
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

APP_PORT="$(sed -n 's/^PORT=//p' .env | tail -n 1)"
APP_PORT="${APP_PORT:-3101}"
node -e "fetch('http://127.0.0.1:${APP_PORT}/api/health').then(async response => { console.log(await response.text()); if (!response.ok) process.exit(1) }).catch(error => { console.error(error.message); process.exit(1) })"
