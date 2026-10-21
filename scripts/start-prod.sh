#!/bin/sh
# Production start-up: launch the tournament data imports in the background (so
# the API starts serving immediately), then start the API.
#
# Each import is idempotent (upserts by url_slug), guarded by its own Postgres
# advisory lock (only one replica imports at a time), and runs in --on-deploy
# mode so a failure can never break the deployment. Once both imports are done,
# tournaments without coordinates are geocoded so they show on the map.
#
# Opt out individually:
#   SEED_EUROSPORTRING_ON_DEPLOY=false   # Euro-Sportring (live scrape)
#   SEED_YOUNGTALENTS_ON_DEPLOY=false    # Young Talents Group (JSON snapshot)
#   GEOCODE_TOURNAMENTS_ON_DEPLOY=false  # fill missing tournament coordinates
#                                        # (Google if GOOGLE_MAPS_API_KEY is
#                                        # set, else OpenStreetMap Nominatim)

(
  if [ "${SEED_EUROSPORTRING_ON_DEPLOY:-true}" != "false" ]; then
    echo "[start-prod] Starting Euro-Sportring seed in background (set SEED_EUROSPORTRING_ON_DEPLOY=false to disable)"
    node dist/seeds/scrape-euro-sportring.js --on-deploy &
  fi

  if [ "${SEED_YOUNGTALENTS_ON_DEPLOY:-true}" != "false" ]; then
    echo "[start-prod] Starting Young Talents Group import in background (set SEED_YOUNGTALENTS_ON_DEPLOY=false to disable)"
    node dist/seeds/import-young-talents.js --on-deploy &
  fi

  # Geocode after the imports so newly imported tournaments are included.
  wait

  if [ "${GEOCODE_TOURNAMENTS_ON_DEPLOY:-true}" != "false" ]; then
    echo "[start-prod] Geocoding tournaments without coordinates (set GEOCODE_TOURNAMENTS_ON_DEPLOY=false to disable)"
    node dist/seeds/geocode-tournaments.js --on-deploy
  fi
) &

exec node dist/main
