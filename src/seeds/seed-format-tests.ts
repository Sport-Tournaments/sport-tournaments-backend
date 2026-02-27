/**
 * Additive seed script for testing ALL tournament format types.
 * Creates 5 tournaments (one per format) owned by cahangeorge@gmail.com,
 * each with 16 registered teams from 16 different clubs.
 *
 * Run: npx ts-node src/seeds/seed-format-tests.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { config } from 'dotenv';
import { v4 as uuid } from 'uuid';

config();

// ───────── Constants ─────────
const ORGANIZER_ID = '5f3ce9b6-b4ef-4cb4-8a20-114bb540c823'; // cahangeorge@gmail.com

const FORMATS = [
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'GROUPS_PLUS_KNOCKOUT',
  'LEAGUE',
] as const;

type FormatType = (typeof FORMATS)[number];

const TOURNAMENT_DEFS: {
  name: string;
  format: FormatType;
  teamCount: number;
  description: string;
}[] = [
  {
    name: 'SE Cup 2026 - Single Elim',
    format: 'SINGLE_ELIMINATION',
    teamCount: 16,
    description: 'Test tournament for Single Elimination bracket format (16 teams)',
  },
  {
    name: 'DE Cup 2026 - Double Elim',
    format: 'DOUBLE_ELIMINATION',
    teamCount: 16,
    description: 'Test tournament for Double Elimination bracket format (16 teams)',
  },
  {
    name: 'RR Cup 2026 - Round Robin',
    format: 'ROUND_ROBIN',
    teamCount: 8,
    description: 'Test tournament for Round Robin (all-play-all) format (8 teams)',
  },
  {
    name: 'GK Cup 2026 - Groups + KO',
    format: 'GROUPS_PLUS_KNOCKOUT',
    teamCount: 16,
    description: 'Test tournament for Groups + Knockout format (16 teams, 4 groups of 4)',
  },
  {
    name: 'League Cup 2026 - League',
    format: 'LEAGUE',
    teamCount: 12,
    description: 'Test tournament for League format (12 teams, home & away)',
  },
];

// Club names from different countries
const CLUB_DEFS = [
  { name: 'FC Bayern Junior', country: 'Germany', city: 'Munich', primary: '#DC052D', secondary: '#FFFFFF' },
  { name: 'FC Barcelona Youth', country: 'Spain', city: 'Barcelona', primary: '#A50044', secondary: '#004D98' },
  { name: 'Manchester City Academy', country: 'United Kingdom', city: 'Manchester', primary: '#6CABDD', secondary: '#FFFFFF' },
  { name: 'Juventus Next Gen', country: 'Italy', city: 'Turin', primary: '#000000', secondary: '#FFFFFF' },
  { name: 'Ajax Youth', country: 'Netherlands', city: 'Amsterdam', primary: '#CF0032', secondary: '#FFFFFF' },
  { name: 'Benfica Juniors', country: 'Portugal', city: 'Lisbon', primary: '#FF0000', secondary: '#FFFFFF' },
  { name: 'PSG Academy', country: 'France', city: 'Paris', primary: '#004170', secondary: '#DA291C' },
  { name: 'Borussia Dortmund Youth', country: 'Germany', city: 'Dortmund', primary: '#FDE100', secondary: '#000000' },
  { name: 'Celtic FC Youth', country: 'United Kingdom', city: 'Glasgow', primary: '#007A33', secondary: '#FFFFFF' },
  { name: 'FC Porto Academy', country: 'Portugal', city: 'Porto', primary: '#003399', secondary: '#FFFFFF' },
  { name: 'Red Bull Salzburg Youth', country: 'Austria', city: 'Salzburg', primary: '#E4003E', secondary: '#FFFFFF' },
  { name: 'Shakhtar Youth', country: 'Ukraine', city: 'Donetsk', primary: '#FF6600', secondary: '#000000' },
  { name: 'Olympiacos Academy', country: 'Greece', city: 'Athens', primary: '#CC0000', secondary: '#FFFFFF' },
  { name: 'Club Brugge Youth', country: 'Belgium', city: 'Bruges', primary: '#0055A5', secondary: '#000000' },
  { name: 'Galatasaray Juniors', country: 'Turkey', city: 'Istanbul', primary: '#FFC72C', secondary: '#AA151B' },
  { name: 'Sporting CP Youth', country: 'Portugal', city: 'Lisbon', primary: '#008847', secondary: '#FFFFFF' },
  { name: 'AS Roma Primavera', country: 'Italy', city: 'Rome', primary: '#8E1F2F', secondary: '#F4A900' },
  { name: 'Feyenoord Academy', country: 'Netherlands', city: 'Rotterdam', primary: '#FF0000', secondary: '#FFFFFF' },
  { name: 'Dynamo Kyiv Youth', country: 'Ukraine', city: 'Kyiv', primary: '#004C97', secondary: '#FFFFFF' },
  { name: 'Steaua București Junior', country: 'Romania', city: 'Bucharest', primary: '#003DA5', secondary: '#CC0000' },
];

// ───────── Helper functions ─────────

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

async function bootstrap() {
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

  // ─── 1. Verify organizer exists ───
  const orgCheck = await ds.query(
    `SELECT id, email FROM "users" WHERE id = $1`,
    [ORGANIZER_ID],
  );
  if (!orgCheck.length) {
    console.error('❌ Organizer user not found:', ORGANIZER_ID);
    process.exit(1);
  }
  console.log(`👤 Organizer: ${orgCheck[0].email}\n`);

  // ─── 2. Create clubs (skip if already exist by name) ───
  console.log('🏟️  Creating clubs & teams...');
  const clubIds: string[] = [];
  const teamIds: string[] = [];

  for (const c of CLUB_DEFS) {
    const existing = await ds.query(
      `SELECT id FROM "clubs" WHERE name = $1`,
      [c.name],
    );
    let clubId: string;
    if (existing.length) {
      clubId = existing[0].id;
      console.log(`  ⏭ Club exists: ${c.name} (${clubId.slice(0, 8)})`);
    } else {
      clubId = uuid();
      await ds.query(
        `INSERT INTO "clubs" (id, name, organizer_id, country, city, primary_color, secondary_color, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [clubId, c.name, ORGANIZER_ID, c.country, c.city, c.primary, c.secondary, `Youth football club from ${c.city}, ${c.country}`],
      );
      console.log(`  ✓ Club created: ${c.name}`);
    }
    clubIds.push(clubId);

    // Create team for this club (U12 birth year 2014)
    const teamName = `${c.name} U12`;
    const existingTeam = await ds.query(
      `SELECT id FROM "teams" WHERE club_id = $1 AND name = $2`,
      [clubId, teamName],
    );
    let teamId: string;
    if (existingTeam.length) {
      teamId = existingTeam[0].id;
    } else {
      teamId = uuid();
      await ds.query(
        `INSERT INTO "teams" (id, club_id, name, age_category, birthyear, coach)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [teamId, clubId, teamName, 'U12', 2014, `Coach ${c.name.split(' ')[1] || c.name.split(' ')[0]}`],
      );
    }
    teamIds.push(teamId);
  }
  console.log(`  Total: ${clubIds.length} clubs, ${teamIds.length} teams\n`);

  // ─── 3. Create tournaments, one per format type ───
  console.log('🏆 Creating tournaments...');
  const tournamentRecords: { id: string; format: FormatType; teamCount: number; name: string }[] = [];

  for (const tDef of TOURNAMENT_DEFS) {
    // Skip if tournament with this exact name already exists
    const existing = await ds.query(
      `SELECT id FROM "tournaments" WHERE name = $1`,
      [tDef.name],
    );
    if (existing.length) {
      console.log(`  ⏭ Tournament exists: ${tDef.name} (${existing[0].id.slice(0, 8)})`);
      // Delete old data to recreate cleanly
      const tId = existing[0].id;
      await ds.query(`DELETE FROM "tournament_pots" WHERE tournament_id = $1`, [tId]);
      await ds.query(`DELETE FROM "groups" WHERE tournament_id = $1`, [tId]);
      await ds.query(`DELETE FROM "registrations" WHERE tournament_id = $1`, [tId]);
      await ds.query(`DELETE FROM "tournament_age_groups" WHERE tournament_id = $1`, [tId]);
      await ds.query(`DELETE FROM "tournaments" WHERE id = $1`, [tId]);
      console.log(`    🗑️  Cleared old data for re-creation`);
    }

    const tId = uuid();
    const startDays = 30 + TOURNAMENT_DEFS.indexOf(tDef) * 7; // stagger start dates
    await ds.query(
      `INSERT INTO "tournaments" (
        id, name, organizer_id, description, status, start_date, end_date,
        location, country, age_category, level, max_teams, current_teams,
        currency, participation_fee, is_published, is_featured,
        registration_deadline, draw_completed, is_private
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        tId,
        tDef.name,
        ORGANIZER_ID,
        tDef.description,
        'PUBLISHED',
        futureDate(startDays),
        futureDate(startDays + 3),
        'Bucharest, Romania',
        'Romania',
        'U12',
        'I',
        tDef.teamCount,
        0,       // will update later
        'EUR',
        150,
        true,
        false,
        futureDate(startDays - 7),
        false,
        false,
      ],
    );
    console.log(`  ✓ Tournament: ${tDef.name} (${tId.slice(0, 8)}) - format: ${tDef.format}`);
    tournamentRecords.push({ id: tId, format: tDef.format, teamCount: tDef.teamCount, name: tDef.name });
  }
  console.log('');

  // ─── 4. Create age groups (one per tournament, with the format) ───
  console.log('📋 Creating age groups...');
  const ageGroupIds = new Map<string, string>(); // tournamentId → ageGroupId

  for (const t of tournamentRecords) {
    const agId = uuid();
    const startDays = 30 + tournamentRecords.indexOf(t) * 7;

    // Groups+Knockout needs groups config
    const groupsCount = t.format === 'GROUPS_PLUS_KNOCKOUT' ? 4 : null;
    const teamsPerGroup = t.format === 'GROUPS_PLUS_KNOCKOUT' ? 4 : 4;

    await ds.query(
      `INSERT INTO "tournament_age_groups" (
        id, tournament_id, birth_year, age_category, format, display_label,
        game_system, team_count, current_teams, start_date, end_date,
        draw_completed, groups_count, teams_per_group
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        agId,
        t.id,
        2014,
        'U12',
        t.format,
        'U12 (2014)',
        '8+1',
        t.teamCount,
        0,
        futureDate(startDays),
        futureDate(startDays + 3),
        false,
        groupsCount,
        teamsPerGroup,
      ],
    );
    ageGroupIds.set(t.id, agId);
    console.log(`  ✓ Age group for ${t.name}: ${t.format}, ${t.teamCount} teams`);
  }
  console.log('');

  // ─── 5. Register teams ───
  console.log('📝 Registering teams...');

  for (const t of tournamentRecords) {
    const agId = ageGroupIds.get(t.id)!;
    let registered = 0;

    for (let i = 0; i < t.teamCount && i < clubIds.length; i++) {
      const regId = uuid();
      const clubId = clubIds[i];
      const teamId = teamIds[i];

      await ds.query(
        `INSERT INTO "registrations" (
          id, tournament_id, age_group_id, club_id, team_id,
          status, number_of_players, coach_name,
          payment_status, fitness_confirmed, paid,
          price_amount, price_currency, paid_amount
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          regId,
          t.id,
          agId,
          clubId,
          teamId,
          'APPROVED',
          16,
          `Coach Team${i + 1}`,
          'COMPLETED',
          true,
          true,
          150,
          'EUR',
          150,
        ],
      );
      registered++;
    }

    // Update current_teams count
    await ds.query(
      `UPDATE "tournaments" SET current_teams = $1 WHERE id = $2`,
      [registered, t.id],
    );
    await ds.query(
      `UPDATE "tournament_age_groups" SET current_teams = $1 WHERE id = $2`,
      [registered, agId],
    );

    console.log(`  ✓ ${t.name}: ${registered} teams registered`);
  }
  console.log('');

  // ─── 6. Summary ───
  console.log('═══════════════════════════════════════════');
  console.log('✅ Seed complete! Created:');
  console.log('═══════════════════════════════════════════');
  console.log(`  Clubs:       ${CLUB_DEFS.length}`);
  console.log(`  Teams:       ${CLUB_DEFS.length}`);
  console.log(`  Tournaments: ${TOURNAMENT_DEFS.length}`);
  console.log('');
  for (const t of tournamentRecords) {
    console.log(`  🏆 ${t.name}`);
    console.log(`     ID: ${t.id}`);
    console.log(`     Format: ${t.format}`);
    console.log(`     Teams: ${t.teamCount}`);
    console.log('');
  }
  console.log('═══════════════════════════════════════════');
  console.log('Next steps:');
  console.log('  1. Login as cahangeorge@gmail.com / Hello1m$');
  console.log('  2. Open each tournament → Pots tab');
  console.log('  3. Assign pots → Execute draw');
  console.log('  4. Go to Matches tab → test scores');
  console.log('═══════════════════════════════════════════');

  await ds.destroy();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
