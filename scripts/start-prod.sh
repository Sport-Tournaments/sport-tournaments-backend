#!/bin/sh
# Production start-up: launch the Euro-Sportring tournament seed in the
# background (so the API starts serving immediately), then start the API.
#
# The seed is idempotent (upserts by url_slug), throttled (1 req/sec), guarded
# by a Postgres advisory lock (only one replica seeds at a time), and runs in
# --on-deploy mode so a failed scrape can never break the deployment.
#
# Opt out by setting SEED_EUROSPORTRING_ON_DEPLOY=false.

if [ "${SEED_EUROSPORTRING_ON_DEPLOY:-true}" != "false" ]; then
  echo "[start-prod] Starting Euro-Sportring seed in background (set SEED_EUROSPORTRING_ON_DEPLOY=false to disable)"
  node dist/seeds/scrape-euro-sportring.js --on-deploy &
fi

exec node dist/main
