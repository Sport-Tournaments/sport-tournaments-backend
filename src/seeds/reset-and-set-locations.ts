/**
 * Reset & Location Setup Script
 * 
 * 1. Clears groups, pots, bracketData, drawCompleted for ALL tournaments
 * 2. Sets real GPS coordinates for each tournament across Romanian cities
 *
 * Run: npx ts-node src/seeds/reset-and-set-locations.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { config } from 'dotenv';

config();

const ROMANIAN_CITIES = [
  { city: 'București',    lat: 44.4268, lng: 26.1025 },
  { city: 'Cluj-Napoca',  lat: 46.7712, lng: 23.6236 },
  { city: 'Timișoara',    lat: 45.7489, lng: 21.2087 },
  { city: 'Iași',         lat: 47.1585, lng: 27.6014 },
  { city: 'Constanța',    lat: 44.1598, lng: 28.6348 },
  { city: 'Brașov',       lat: 45.6427, lng: 25.5887 },
  { city: 'Craiova',      lat: 44.3302, lng: 23.7949 },
  { city: 'Sibiu',        lat: 45.7983, lng: 24.1256 },
  { city: 'Oradea',       lat: 47.0465, lng: 21.9189 },
  { city: 'Galați',       lat: 45.4353, lng: 28.0080 },
  { city: 'Ploiești',     lat: 44.9462, lng: 26.0254 },
  { city: 'Arad',         lat: 46.1866, lng: 21.3123 },
  { city: 'Pitești',      lat: 44.8565, lng: 24.8692 },
  { city: 'Baia Mare',    lat: 47.6567, lng: 23.5850 },
  { city: 'Buzău',        lat: 45.1500, lng: 26.8333 },
  { city: 'Târgu Mureș',  lat: 46.5456, lng: 24.5625 },
  { city: 'Bacău',        lat: 46.5670, lng: 26.9146 },
  { city: 'Suceava',      lat: 47.6514, lng: 26.2554 },
  { city: 'Piatra Neamț', lat: 46.9275, lng: 26.3716 },
  { city: 'Alba Iulia',   lat: 46.0764, lng: 23.5808 },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  const sslConfig =
    sslMode === 'disable' || sslMode === 'false'
      ? false
      : { rejectUnauthorized: false };

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
    synchronize: false,
    logging: false,
    ssl: sslConfig,
  });

  await ds.initialize();
  console.log('✅ DB connected\n');

  // ─── 1. Get all tournaments ───
  const tournaments = await ds.query(
    `SELECT id, name, location, latitude, longitude FROM tournaments ORDER BY name`,
  );
  console.log(`📋 Found ${tournaments.length} tournaments\n`);

  // ─── 2. Reset groups, pots, bracketData, drawCompleted ───
  console.log('🔄 Resetting groups, pots, matches (bracketData)...\n');

  // Delete all groups
  const groupResult = await ds.query(`DELETE FROM "groups"`);
  console.log(`  🗑️  Deleted ${groupResult[1] ?? 'all'} groups`);

  // Delete all pots
  const potResult = await ds.query(`DELETE FROM "tournament_pots"`);
  console.log(`  🗑️  Deleted ${potResult[1] ?? 'all'} pot assignments`);

  // Clear bracketData and reset drawCompleted for all tournaments
  await ds.query(
    `UPDATE "tournaments" SET bracket_data = NULL, draw_completed = false, draw_seed = NULL`,
  );
  console.log('  ✓ Cleared bracketData, drawCompleted, drawSeed on all tournaments');

  // Clear drawCompleted on all age groups
  await ds.query(
    `UPDATE "tournament_age_groups" SET draw_completed = false, draw_seed = NULL`,
  );
  console.log('  ✓ Reset drawCompleted on all age groups');

  // Clear groupAssignment on all registrations
  await ds.query(
    `UPDATE "registrations" SET group_assignment = NULL`,
  );
  console.log('  ✓ Cleared groupAssignment on all registrations');

  console.log('');

  // ─── 3. Set locations with GPS coordinates ───
  console.log('📍 Setting tournament locations with GPS coordinates...\n');

  for (let i = 0; i < tournaments.length; i++) {
    const t = tournaments[i];
    const loc = ROMANIAN_CITIES[i % ROMANIAN_CITIES.length];

    await ds.query(
      `UPDATE "tournaments" SET location = $1, latitude = $2, longitude = $3, country = 'Romania' WHERE id = $4`,
      [`${loc.city}, Romania`, loc.lat, loc.lng, t.id],
    );
    console.log(`  📍 ${t.name} → ${loc.city} (${loc.lat}, ${loc.lng})`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('✅ Reset complete!');
  console.log('═══════════════════════════════════════════');
  console.log(`  Tournaments reset: ${tournaments.length}`);
  console.log('  Groups: cleared');
  console.log('  Pots: cleared');
  console.log('  Bracket data: cleared');
  console.log('  Draw flags: reset');
  console.log('  Locations: set with GPS coordinates');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open each tournament');
  console.log('  2. Go to Pots → assign pots → Execute draw');
  console.log('  3. Go to Matches → Generate bracket → test scores');
  console.log('═══════════════════════════════════════════');

  await ds.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
