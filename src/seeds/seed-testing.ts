/**
 * ─────────────────────────────────────────────────────────────────
 * Test-Data Seed  –  sport-tournaments-backend
 * ─────────────────────────────────────────────────────────────────
 * Creates a self-contained test dataset:
 *   • 1 admin, 2 organizers, 2 participants (deterministic credentials)
 *   • 20 clubs (10 per participant) + matching U12 teams
 *   • 5 tournaments – one per format:
 *       SE (16), DE (16), RR (8), GK/Groups+KO (16), League (12)
 *   • All registrations → APPROVED / COMPLETED payment
 *
 * ⛔  NOT seeded (left for manual testing):
 *       – Pot assignments & draw execution
 *       – Match results
 *
 * Run:
 *   cd sport-tournaments-backend
 *   npx ts-node src/seeds/seed-testing.ts
 *
 * Re-runnable – existing rows are wiped and recreated on every run.
 * ─────────────────────────────────────────────────────────────────
 */
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { config } from 'dotenv';

config({ path: join(__dirname, '../../.env') });

// ─── Types ────────────────────────────────────────────────────────────────────

type FormatType =
  | 'SINGLE_ELIMINATION'
  | 'DOUBLE_ELIMINATION'
  | 'ROUND_ROBIN'
  | 'GROUPS_PLUS_KNOCKOUT'
  | 'LEAGUE';

// ─── Test Accounts ────────────────────────────────────────────────────────────

const ACCOUNTS = [
  {
    id: '11000000-0000-0000-0000-000000000001',
    email: 'test.admin@sport.ro',
    password: 'Admin123!',
    role: 'ADMIN',
    firstName: 'Admin',
    lastName: 'Tester',
    organizationName: 'Sport Tournaments Platform',
  },
  {
    id: '11000000-0000-0000-0000-000000000002',
    email: 'test.organizer1@sport.ro',
    password: 'Test123!',
    role: 'ORGANIZER',
    firstName: 'Andrei',
    lastName: 'Ionescu',
    organizationName: 'Academie Fotbal România',
  },
  {
    id: '11000000-0000-0000-0000-000000000003',
    email: 'test.organizer2@sport.ro',
    password: 'Test123!',
    role: 'ORGANIZER',
    firstName: 'Mihai',
    lastName: 'Popescu',
    organizationName: 'Federatia Judet Cluj',
  },
  {
    id: '11000000-0000-0000-0000-000000000004',
    email: 'test.participant1@sport.ro',
    password: 'Test123!',
    role: 'PARTICIPANT',
    firstName: 'Elena',
    lastName: 'Dumitrescu',
    organizationName: null,
  },
  {
    id: '11000000-0000-0000-0000-000000000005',
    email: 'test.participant2@sport.ro',
    password: 'Test123!',
    role: 'PARTICIPANT',
    firstName: 'Bogdan',
    lastName: 'Constantin',
    organizationName: null,
  },
] as const;

// ─── Clubs (20 total) ─────────────────────────────────────────────────────────
// Clubs 0–9  → owned by participant1 (index 3 in ACCOUNTS)
// Clubs 10–19 → owned by participant2 (index 4 in ACCOUNTS)

const CLUBS = [
  // participant1 clubs
  { id: '22000000-0000-0000-0000-000000000001', name: 'FC Bayern Junior',          country: 'Germany',        city: 'Munich',     primary: '#DC052D', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000002', name: 'FC Barcelona Youth',         country: 'Spain',          city: 'Barcelona',  primary: '#A50044', secondary: '#004D98' },
  { id: '22000000-0000-0000-0000-000000000003', name: 'Manchester City Academy',    country: 'United Kingdom', city: 'Manchester', primary: '#6CABDD', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000004', name: 'Juventus Next Gen',          country: 'Italy',          city: 'Turin',      primary: '#000000', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000005', name: 'Ajax Youth',                 country: 'Netherlands',    city: 'Amsterdam',  primary: '#CF0032', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000006', name: 'Benfica Juniors',            country: 'Portugal',       city: 'Lisbon',     primary: '#FF0000', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000007', name: 'PSG Academy',               country: 'France',         city: 'Paris',      primary: '#004170', secondary: '#DA291C' },
  { id: '22000000-0000-0000-0000-000000000008', name: 'Borussia Dortmund Youth',   country: 'Germany',        city: 'Dortmund',   primary: '#FDE100', secondary: '#000000' },
  { id: '22000000-0000-0000-0000-000000000009', name: 'Celtic FC Youth',           country: 'United Kingdom', city: 'Glasgow',    primary: '#007A33', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000010', name: 'FC Porto Academy',          country: 'Portugal',       city: 'Porto',      primary: '#003399', secondary: '#FFFFFF' },
  // participant2 clubs
  { id: '22000000-0000-0000-0000-000000000011', name: 'Red Bull Salzburg Youth',   country: 'Austria',        city: 'Salzburg',   primary: '#E4003E', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000012', name: 'Shakhtar Youth',            country: 'Ukraine',        city: 'Donetsk',    primary: '#FF6600', secondary: '#000000' },
  { id: '22000000-0000-0000-0000-000000000013', name: 'Olympiacos Academy',        country: 'Greece',         city: 'Athens',     primary: '#CC0000', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000014', name: 'Club Brugge Youth',         country: 'Belgium',        city: 'Bruges',     primary: '#0055A5', secondary: '#000000' },
  { id: '22000000-0000-0000-0000-000000000015', name: 'Galatasaray Juniors',       country: 'Turkey',         city: 'Istanbul',   primary: '#FFC72C', secondary: '#AA151B' },
  { id: '22000000-0000-0000-0000-000000000016', name: 'Sporting CP Youth',         country: 'Portugal',       city: 'Lisbon',     primary: '#008847', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000017', name: 'AS Roma Primavera',         country: 'Italy',          city: 'Rome',       primary: '#8E1F2F', secondary: '#F4A900' },
  { id: '22000000-0000-0000-0000-000000000018', name: 'Feyenoord Academy',         country: 'Netherlands',    city: 'Rotterdam',  primary: '#FF0000', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000019', name: 'Dynamo Kyiv Youth',         country: 'Ukraine',        city: 'Kyiv',       primary: '#004C97', secondary: '#FFFFFF' },
  { id: '22000000-0000-0000-0000-000000000020', name: 'Steaua București Junior',   country: 'Romania',        city: 'Bucharest',  primary: '#003DA5', secondary: '#CC0000' },
] as const;

// ─── Tournaments (5 formats) ───────────────────────────────────────────────────

const TOURNAMENTS: {
  id: string;
  ageGroupId: string;
  name: string;
  format: FormatType;
  teamCount: number;
  startOffset: number; // days from today
  groupsCount: number | null;
  teamsPerGroup: number;
  description: string;
}[] = [
  // ── Single Elimination (4) ──────────────────────────────────────────────────
  {
    id: '33000000-0000-0000-0000-000000000001',
    ageGroupId: '44000000-0000-0000-0000-000000000001',
    name: 'SE Premier Cup 2026',
    format: 'SINGLE_ELIMINATION',
    teamCount: 16,
    startOffset: 30,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Single Elimination Premier – 16 teams, main bracket.',
  },
  {
    id: '33000000-0000-0000-0000-000000000002',
    ageGroupId: '44000000-0000-0000-0000-000000000002',
    name: 'SE Gold Cup 2026',
    format: 'SINGLE_ELIMINATION',
    teamCount: 16,
    startOffset: 31,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Single Elimination Gold – 16 teams, straight knockout.',
  },
  {
    id: '33000000-0000-0000-0000-000000000003',
    ageGroupId: '44000000-0000-0000-0000-000000000003',
    name: 'SE Silver Cup 2026',
    format: 'SINGLE_ELIMINATION',
    teamCount: 8,
    startOffset: 32,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Single Elimination Silver – 8 teams, quarterfinals onwards.',
  },
  {
    id: '33000000-0000-0000-0000-000000000004',
    ageGroupId: '44000000-0000-0000-0000-000000000004',
    name: 'SE Bronze Cup 2026',
    format: 'SINGLE_ELIMINATION',
    teamCount: 8,
    startOffset: 33,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Single Elimination Bronze – 8 teams, fast-track bracket.',
  },

  // ── Double Elimination (4) ──────────────────────────────────────────────────
  {
    id: '33000000-0000-0000-0000-000000000005',
    ageGroupId: '44000000-0000-0000-0000-000000000005',
    name: 'DE Premier Cup 2026',
    format: 'DOUBLE_ELIMINATION',
    teamCount: 16,
    startOffset: 45,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Double Elimination Premier – 16 teams, winners & losers bracket.',
  },
  {
    id: '33000000-0000-0000-0000-000000000006',
    ageGroupId: '44000000-0000-0000-0000-000000000006',
    name: 'DE Gold Cup 2026',
    format: 'DOUBLE_ELIMINATION',
    teamCount: 16,
    startOffset: 46,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Double Elimination Gold – 16 teams, second-chance bracket.',
  },
  {
    id: '33000000-0000-0000-0000-000000000007',
    ageGroupId: '44000000-0000-0000-0000-000000000007',
    name: 'DE Silver Cup 2026',
    format: 'DOUBLE_ELIMINATION',
    teamCount: 8,
    startOffset: 47,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Double Elimination Silver – 8 teams, compact DE bracket.',
  },
  {
    id: '33000000-0000-0000-0000-000000000008',
    ageGroupId: '44000000-0000-0000-0000-000000000008',
    name: 'DE Bronze Cup 2026',
    format: 'DOUBLE_ELIMINATION',
    teamCount: 8,
    startOffset: 48,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Double Elimination Bronze – 8 teams, loser-bracket repechage.',
  },

  // ── Round Robin (4) ─────────────────────────────────────────────────────────
  {
    id: '33000000-0000-0000-0000-000000000009',
    ageGroupId: '44000000-0000-0000-0000-000000000009',
    name: 'RR Premier Cup 2026',
    format: 'ROUND_ROBIN',
    teamCount: 8,
    startOffset: 60,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Round Robin Premier – 8 teams, all-play-all, ranked by points.',
  },
  {
    id: '33000000-0000-0000-0000-000000000010',
    ageGroupId: '44000000-0000-0000-0000-000000000010',
    name: 'RR Gold Cup 2026',
    format: 'ROUND_ROBIN',
    teamCount: 8,
    startOffset: 61,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Round Robin Gold – 8 teams, full standings competition.',
  },
  {
    id: '33000000-0000-0000-0000-000000000011',
    ageGroupId: '44000000-0000-0000-0000-000000000011',
    name: 'RR Silver Cup 2026',
    format: 'ROUND_ROBIN',
    teamCount: 6,
    startOffset: 62,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Round Robin Silver – 6 teams, balanced mini-league.',
  },
  {
    id: '33000000-0000-0000-0000-000000000012',
    ageGroupId: '44000000-0000-0000-0000-000000000012',
    name: 'RR Bronze Cup 2026',
    format: 'ROUND_ROBIN',
    teamCount: 6,
    startOffset: 63,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'Round Robin Bronze – 6 teams, short round-robin format.',
  },

  // ── Groups + Knockout (4) ───────────────────────────────────────────────────
  {
    id: '33000000-0000-0000-0000-000000000013',
    ageGroupId: '44000000-0000-0000-0000-000000000013',
    name: 'GK Premier Cup 2026',
    format: 'GROUPS_PLUS_KNOCKOUT',
    teamCount: 16,
    startOffset: 75,
    groupsCount: 4,
    teamsPerGroup: 4,
    description: 'Groups + KO Premier – 16 teams, 4 groups of 4, top 2 advance.',
  },
  {
    id: '33000000-0000-0000-0000-000000000014',
    ageGroupId: '44000000-0000-0000-0000-000000000014',
    name: 'GK Gold Cup 2026',
    format: 'GROUPS_PLUS_KNOCKOUT',
    teamCount: 16,
    startOffset: 76,
    groupsCount: 4,
    teamsPerGroup: 4,
    description: 'Groups + KO Gold – 16 teams, 4 groups, knockout stage.',
  },
  {
    id: '33000000-0000-0000-0000-000000000015',
    ageGroupId: '44000000-0000-0000-0000-000000000015',
    name: 'GK Silver Cup 2026',
    format: 'GROUPS_PLUS_KNOCKOUT',
    teamCount: 8,
    startOffset: 77,
    groupsCount: 2,
    teamsPerGroup: 4,
    description: 'Groups + KO Silver – 8 teams, 2 groups of 4, top 2 per group to semis.',
  },
  {
    id: '33000000-0000-0000-0000-000000000016',
    ageGroupId: '44000000-0000-0000-0000-000000000016',
    name: 'GK Bronze Cup 2026',
    format: 'GROUPS_PLUS_KNOCKOUT',
    teamCount: 8,
    startOffset: 78,
    groupsCount: 2,
    teamsPerGroup: 4,
    description: 'Groups + KO Bronze – 8 teams, 2 groups, semifinals + final.',
  },

  // ── League (4) ──────────────────────────────────────────────────────────────
  {
    id: '33000000-0000-0000-0000-000000000017',
    ageGroupId: '44000000-0000-0000-0000-000000000017',
    name: 'League Premier Cup 2026',
    format: 'LEAGUE',
    teamCount: 12,
    startOffset: 90,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'League Premier – 12 teams, home & away, full season.',
  },
  {
    id: '33000000-0000-0000-0000-000000000018',
    ageGroupId: '44000000-0000-0000-0000-000000000018',
    name: 'League Gold Cup 2026',
    format: 'LEAGUE',
    teamCount: 12,
    startOffset: 91,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'League Gold – 12 teams, season-long standings competition.',
  },
  {
    id: '33000000-0000-0000-0000-000000000019',
    ageGroupId: '44000000-0000-0000-0000-000000000019',
    name: 'League Silver Cup 2026',
    format: 'LEAGUE',
    teamCount: 8,
    startOffset: 92,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'League Silver – 8 teams, compact table format.',
  },
  {
    id: '33000000-0000-0000-0000-000000000020',
    ageGroupId: '44000000-0000-0000-0000-000000000020',
    name: 'League Bronze Cup 2026',
    format: 'LEAGUE',
    teamCount: 8,
    startOffset: 93,
    groupsCount: null,
    teamsPerGroup: 4,
    description: 'League Bronze – 8 teams, short league stage.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

async function hashPwd(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌  DATABASE_URL not set — add it to .env or export it before running');
    process.exit(1);
  }

  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  const ssl =
    sslMode === 'disable' || sslMode === 'false' ? false : { rejectUnauthorized: false };

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
    synchronize: false,
    logging: false,
    ssl,
  });

  await ds.initialize();
  console.log('✅  DB connected\n');

  const qr = ds.createQueryRunner();
  await qr.connect();

  try {
    // ── 0. Clean up previous test data ──────────────────────────────────────
    console.log('🗑️   Cleaning previous test data...');
    const tournamentIds = TOURNAMENTS.map((t) => `'${t.id}'`).join(',');
    const clubIds = CLUBS.map((c) => `'${c.id}'`).join(',');
    const userIds = ACCOUNTS.map((a) => `'${a.id}'`).join(',');
    const ageGroupIds = TOURNAMENTS.map((t) => `'${t.ageGroupId}'`).join(',');

    await qr.query(`DELETE FROM "tournament_pots"         WHERE tournament_id IN (${tournamentIds})`);
    await qr.query(`DELETE FROM "groups"                  WHERE tournament_id IN (${tournamentIds})`);
    await qr.query(`DELETE FROM "registrations"           WHERE tournament_id IN (${tournamentIds})`);
    await qr.query(`DELETE FROM "tournament_age_groups"   WHERE id IN (${ageGroupIds})`);
    await qr.query(`DELETE FROM "tournaments"             WHERE id IN (${tournamentIds})`);
    // Also delete any stale clubs that share our deterministic names (e.g. from seed-format-tests)
    const clubNames = CLUBS.map((c) => `'${c.name.replace(/'/g, "''")}'`).join(',');
    const staleClubs = await qr.query(
      `SELECT id FROM "clubs" WHERE name IN (${clubNames})`,
    );
    if (staleClubs.length) {
      const staleIds = staleClubs.map((r: { id: string }) => `'${r.id}'`).join(',');
      await qr.query(`DELETE FROM "registrations" WHERE club_id IN (${staleIds})`);
      await qr.query(`DELETE FROM "teams"         WHERE club_id IN (${staleIds})`);
      await qr.query(`DELETE FROM "clubs"         WHERE id IN (${staleIds})`);
    }
    await qr.query(`DELETE FROM "teams"  WHERE club_id IN (${clubIds})`);
    await qr.query(`DELETE FROM "clubs"  WHERE id IN (${clubIds})`);
    await qr.query(`DELETE FROM "users"  WHERE id IN (${userIds})`);
    // Also clean stale users by our deterministic emails
    const emails = ACCOUNTS.map((a) => `'${a.email}'`).join(',');
    await qr.query(`DELETE FROM "users" WHERE email IN (${emails})`);
    console.log('   Done.\n');

    // ── 1. Users ─────────────────────────────────────────────────────────────
    console.log('👥  Creating users...');

    for (const acc of ACCOUNTS) {
      const hashed = await hashPwd(acc.password);
      await qr.query(
        `INSERT INTO "users"
           (id, email, password, first_name, last_name, role, is_active, is_verified,
            organization_name, country, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
        [
          acc.id,
          acc.email,
          hashed,
          acc.firstName,
          acc.lastName,
          acc.role,
          true,
          true,
          acc.organizationName,
          'Romania',
        ],
      );
      console.log(`   ✓ [${acc.role.padEnd(11)}] ${acc.email}`);
    }
    console.log('');

    // ── 2. Clubs ─────────────────────────────────────────────────────────────
    console.log('🏟️   Creating clubs...');
    const participant1Id = ACCOUNTS[3].id; // test.participant1
    const participant2Id = ACCOUNTS[4].id; // test.participant2

    for (let i = 0; i < CLUBS.length; i++) {
      const c = CLUBS[i];
      const ownerId = i < 10 ? participant1Id : participant2Id;

      await qr.query(
        `INSERT INTO "clubs"
           (id, name, organizer_id, country, city, primary_color, secondary_color, description, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        [
          c.id,
          c.name,
          ownerId,
          c.country,
          c.city,
          c.primary,
          c.secondary,
          `Youth football club from ${c.city}, ${c.country}`,
        ],
      );
    }
    console.log(`   ✓ ${CLUBS.length} clubs created\n`);

    // ── 3. Teams (one U12 per club) ───────────────────────────────────────────
    console.log('👕  Creating teams...');
    const teamIds: Record<string, string> = {}; // clubId → teamId

    for (const c of CLUBS) {
      const teamId = randomUUID();
      teamIds[c.id] = teamId;
      await qr.query(
        `INSERT INTO "teams"
           (id, club_id, name, age_category, birthyear, coach, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [teamId, c.id, `${c.name} U12`, 'U12', 2014, `Coach ${c.name.split(' ')[0]}`],
      );
    }
    console.log(`   ✓ ${CLUBS.length} teams created (U12 / birth year 2014)\n`);

    // ── 4. Tournaments + Age Groups ───────────────────────────────────────────
    console.log('🏆  Creating tournaments & age groups...');
    const organizer1Id = ACCOUNTS[1].id; // test.organizer1

    for (const t of TOURNAMENTS) {
      const start = futureDate(t.startOffset);
      const end = futureDate(t.startOffset + 3);
      const deadline = futureDate(t.startOffset - 10);

      await qr.query(
        `INSERT INTO "tournaments"
           (id, name, organizer_id, description, status, start_date, end_date,
            location, country, age_category, level, max_teams, current_teams,
            currency, participation_fee, is_published, is_featured,
            registration_deadline, draw_completed, is_private, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())`,
        [
          t.id,
          t.name,
          organizer1Id,
          t.description,
          'PUBLISHED',
          start,
          end,
          'Bucharest, Romania',
          'Romania',
          'U12',
          'I',
          t.teamCount,
          0,          // updated after registrations
          'EUR',
          150,
          true,
          false,
          deadline,
          false,      // ← draw NOT completed (waiting for manual testing)
          false,
        ],
      );

      await qr.query(
        `INSERT INTO "tournament_age_groups"
           (id, tournament_id, birth_year, age_category, format, display_label,
            game_system, team_count, current_teams, start_date, end_date,
            draw_completed, groups_count, teams_per_group, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
        [
          t.ageGroupId,
          t.id,
          2014,
          'U12',
          t.format,
          'U12 (2014)',
          '8+1',
          t.teamCount,
          0,
          start,
          end,
          false,
          t.groupsCount,
          t.teamsPerGroup,
        ],
      );

      console.log(`   ✓ ${t.name}  [${t.format}]  ${t.teamCount} slots`);
    }
    console.log('');

    // ── 5. Registrations (APPROVED) ────────────────────────────────────────────
    console.log('📝  Registering teams...');
    const clubList = [...CLUBS]; // 20 clubs in order

    for (const t of TOURNAMENTS) {
      let registered = 0;

      for (let i = 0; i < t.teamCount && i < clubList.length; i++) {
        const club = clubList[i];
        const teamId = teamIds[club.id];
        const regId = randomUUID();

        await qr.query(
          `INSERT INTO "registrations"
             (id, tournament_id, age_group_id, club_id, team_id,
              status, number_of_players, coach_name,
              payment_status, fitness_confirmed, paid,
              price_amount, price_currency, paid_amount, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
          [
            regId,
            t.id,
            t.ageGroupId,
            club.id,
            teamId,
            'APPROVED',
            16,
            `Coach ${club.name.split(' ')[0]}`,
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

      // Sync current_teams counter
      await qr.query(
        `UPDATE "tournaments"            SET current_teams = $1 WHERE id = $2`,
        [registered, t.id],
      );
      await qr.query(
        `UPDATE "tournament_age_groups"  SET current_teams = $1 WHERE id = $2`,
        [registered, t.ageGroupId],
      );

      console.log(`   ✓ ${t.name}: ${registered}/${t.teamCount} teams registered`);
    }
    console.log('');

    // ── 6. Summary ─────────────────────────────────────────────────────────────
    printSummary();
  } catch (err) {
    console.error('❌  Seed failed:', err);
    throw err;
  } finally {
    await qr.release();
    await ds.destroy();
  }

  process.exit(0);
}

function printSummary() {
  const RESET = '\x1b[0m';
  const BOLD  = '\x1b[1m';
  const GREEN = '\x1b[32m';
  const CYAN  = '\x1b[36m';
  const YELLOW = '\x1b[33m';

  console.log(`${BOLD}${'═'.repeat(60)}${RESET}`);
  console.log(`${GREEN}${BOLD}✅  Seed completed successfully!${RESET}`);
  console.log(`${'═'.repeat(60)}`);

  console.log(`\n${CYAN}${BOLD}👥  TEST ACCOUNTS${RESET}`);
  console.log('┌──────────────────────────────────┬─────────────┬────────────┐');
  console.log('│ Email                            │ Role        │ Password   │');
  console.log('├──────────────────────────────────┼─────────────┼────────────┤');
  for (const a of ACCOUNTS) {
    const email = a.email.padEnd(32);
    const role  = a.role.padEnd(11);
    const pwd   = a.password.padEnd(10);
    console.log(`│ ${email} │ ${role} │ ${pwd} │`);
  }
  console.log('└──────────────────────────────────┴─────────────┴────────────┘');

  console.log(`\n${CYAN}${BOLD}🏆  TOURNAMENTS${RESET}`);
  for (const t of TOURNAMENTS) {
    console.log(`\n  ${BOLD}${t.name}${RESET}  –  ${YELLOW}${t.format}${RESET}`);
    console.log(`    Tournament ID : ${t.id}`);
    console.log(`    Age Group ID  : ${t.ageGroupId}`);
    console.log(`    Teams         : ${t.teamCount}`);
  }

  console.log(`\n${BOLD}${'═'.repeat(60)}${RESET}`);
  console.log(`${YELLOW}${BOLD}⚡  Next steps for manual testing:${RESET}`);
  console.log('  1. Login as test.organizer1@sport.ro / Test123!');
  console.log('  2. For each tournament → open "Pots" tab → assign pots → execute draw');
  console.log('  3. After draw → open "Matches" tab → enter scores');
  console.log('  4. Use test.participant1/2 to verify read-only view');
  console.log('  5. Use test.organizer2 to verify security (403 on mutations)');
  console.log(`${'═'.repeat(60)}\n`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
