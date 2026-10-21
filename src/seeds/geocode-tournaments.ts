/**
 * Tournament geocoder.
 *
 * Fills in `tournaments.latitude` / `longitude` from the stored address / POI
 * (`venue_name`, `location`, `country`) so every tournament shows up on the
 * map. Imported tournaments (Young Talents Group, most Euro-Sportring ones)
 * only carry a town and country, so they are placed at the town.
 *
 * Provider: Google Geocoding API when GOOGLE_MAPS_API_KEY is set, otherwise
 * OpenStreetMap Nominatim (free, no key, throttled to 1 request/second).
 *
 * Idempotent: only tournaments without coordinates are processed (unless
 * --force), and identical queries are geocoded once per run. Importers'
 * upserts don't clear the coordinates, so re-imports keep them.
 *
 * Usage:
 *   pnpm geocode:tournaments                 # fill missing coordinates
 *   pnpm geocode:tournaments -- --dry-run    # resolve + report, no writes
 *   pnpm geocode:tournaments -- --limit=20   # only first N tournaments
 *   pnpm geocode:tournaments -- --force      # re-geocode all tournaments
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import {
  buildGeocodeQueries,
  geocode,
  GeocodeResult,
  toCountryCode,
} from '../common/geocoding';

config();

// Distinct from the importers' locks so they can run side by side.
const ADVISORY_LOCK_KEY = 728_311_957;
const NOMINATIM_DELAY_MS = 1100;
const GOOGLE_DELAY_MS = 50;

interface CliOptions {
  dryRun: boolean;
  force: boolean;
  onDeploy: boolean;
  limit?: number;
}

interface TournamentRow {
  id: string;
  name: string;
  location: string | null;
  venue_name: string | null;
  country: string | null;
}

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, force: false, onDeploy: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--on-deploy') options.onDeploy = true;
    else if (arg.startsWith('--limit='))
      options.limit = parseInt(arg.slice(8), 10);
  }
  return options;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connect(): Promise<DataSource> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  const sslMode = new URL(databaseUrl).searchParams.get('sslmode');
  // Raw SQL only: no entities, and never touch the schema from here.
  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    ssl:
      sslMode === 'disable' || sslMode === 'false'
        ? false
        : { rejectUnauthorized: false },
  });
  await dataSource.initialize();
  return dataSource;
}

async function main(options: CliOptions): Promise<void> {
  let googleApiKey = process.env.GOOGLE_MAPS_API_KEY || undefined;
  let delay = googleApiKey ? GOOGLE_DELAY_MS : NOMINATIM_DELAY_MS;
  console.log('🗺️  Geocoding tournaments');
  console.log(
    `   provider: ${googleApiKey ? 'Google Geocoding API' : 'OpenStreetMap Nominatim (no API key)'}` +
      `${options.dryRun ? ' | DRY RUN' : ''}${options.force ? ' | force' : ''}`,
  );

  const dataSource = await connect();
  const lockRunner = dataSource.createQueryRunner();
  await lockRunner.connect();
  const [{ locked }] = (await lockRunner.query(
    'SELECT pg_try_advisory_lock($1) AS locked',
    [ADVISORY_LOCK_KEY],
  )) as [{ locked: boolean }];
  if (!locked) {
    console.log('🔒 Another instance is already geocoding — skipping.');
    await lockRunner.release();
    await dataSource.destroy();
    return;
  }

  try {
    const rows = await dataSource.query<TournamentRow[]>(
      `SELECT id, name, location, venue_name, country
         FROM tournaments
        ${
          options.force
            ? ''
            : // 0,0 is "Null Island" — a placeholder, not a real venue.
              `WHERE latitude IS NULL OR longitude IS NULL
                  OR (latitude = 0 AND longitude = 0)`
        }
        ORDER BY created_at DESC
        ${options.limit ? `LIMIT ${Math.max(1, options.limit)}` : ''}`,
    );
    console.log(`   ${rows.length} tournaments to geocode\n`);

    const cache = new Map<string, GeocodeResult | null>();
    let updated = 0;
    let notFound = 0;
    let failed = 0;
    let requests = 0;

    for (let i = 0; i < rows.length; i++) {
      const t = rows[i];
      const countryCode = toCountryCode(t.country);
      const queries = buildGeocodeQueries({
        location: t.location,
        venueName: t.venue_name,
        country: t.country,
      });

      let result: GeocodeResult | null = null;
      try {
        for (const query of queries) {
          const key = `${countryCode ?? ''}|${query.toLowerCase()}`;
          if (!cache.has(key)) {
            if (requests > 0) await sleep(delay);
            requests++;
            cache.set(key, await geocode(query, { countryCode, googleApiKey }));
          }
          result = cache.get(key) ?? null;
          if (result) break;
        }
      } catch (error) {
        failed++;
        console.warn(
          `  ⚠ [${i + 1}/${rows.length}] ${t.name}: ${(error as Error).message}`,
        );
        const fatal = /REQUEST_DENIED|OVER_QUERY_LIMIT|HTTP 403|HTTP 429/.test(
          String(error),
        );
        if (fatal && googleApiKey) {
          // e.g. the key is only enabled for Places, not the Geocoding API.
          console.warn(
            '  ↪ Google rejected the request; continuing with OpenStreetMap Nominatim',
          );
          googleApiKey = undefined;
          delay = NOMINATIM_DELAY_MS;
          failed--;
          cache.clear();
          i--; // retry this tournament with the new provider
          continue;
        }
        // Rejected or rate-limited by Nominatim: every request would fail.
        if (fatal) throw error;
        continue;
      }

      if (!result) {
        notFound++;
        console.log(
          `  ✗ [${i + 1}/${rows.length}] ${t.name} — no match for "${queries[0] ?? '(no address)'}"`,
        );
        continue;
      }

      console.log(
        `  ✓ [${i + 1}/${rows.length}] ${t.name} → ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)} (${result.label})`,
      );
      if (!options.dryRun) {
        await dataSource.query(
          `UPDATE tournaments SET latitude = $2, longitude = $3 WHERE id = $1`,
          [t.id, result.latitude, result.longitude],
        );
      }
      updated++;
    }

    console.log('');
    console.log(
      `🏁 Done: ${updated} ${options.dryRun ? 'resolved (not saved)' : 'updated'}, ${notFound} not found, ${failed} errors, ${requests} geocoder requests`,
    );
  } finally {
    await lockRunner.query('SELECT pg_advisory_unlock($1)', [
      ADVISORY_LOCK_KEY,
    ]);
    await lockRunner.release();
    await dataSource.destroy();
  }
}

const cliOptions = parseCli(process.argv.slice(2));
main(cliOptions).catch((error) => {
  console.error('❌ Geocoding failed:', error);
  // In deploy mode a failure must never fail the deployment/start-up.
  process.exit(cliOptions.onDeploy ? 0 : 1);
});
