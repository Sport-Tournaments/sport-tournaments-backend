/**
 * Cleanup dummy / test data from the database.
 *
 * Removes tournaments (and their cascaded children: age groups, locations,
 * registrations, pots, groups, invitations) that are clearly test data, plus
 * any leads tied to them. Matches on two dimensions:
 *   1. tournament name patterns (ILIKE) — e.g. "FilterTest-*", the format-test
 *      cups, e2e fixtures;
 *   2. tournaments owned by a test-account email (LIKE) — e.g. *@test.com.
 *
 * SAFE BY DEFAULT: runs as a dry-run (reports what it *would* delete) unless
 * you pass --apply. Real seeded data (Euro-Sportring / Young Talents import
 * organizers) is explicitly protected and never touched.
 *
 * Usage:
 *   pnpm cleanup:dummy                       # dry-run report (no writes)
 *   pnpm cleanup:dummy -- --apply            # actually delete
 *   pnpm cleanup:dummy -- --name-like='QA %' # add a name pattern (repeatable)
 *   pnpm cleanup:dummy -- --email-like='%@qa.io'   # add an owner-email pattern
 *   pnpm cleanup:dummy -- --apply --delete-test-users  # also delete the test users
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { config } from 'dotenv';

config();

// Never delete data owned by these real-data import accounts.
const PROTECTED_EMAILS = [
  'import.youngtalentsgroup@turnee-sportive.ro',
  'import.eurosportring@turnee-sportive.ro',
];

// Tournament name patterns (Postgres ILIKE, case-insensitive).
const DEFAULT_NAME_PATTERNS = [
  'FilterTest%',
  'FilterTest-%',
  'SE Cup 2026%',
  'DE Cup 2026%',
  'RR Cup 2026%',
  'GK Cup 2026%',
  'League Cup 2026%',
  'DE Gold Cup%',
  'DE Silver Cup%',
  'DE Bronze Cup%',
  'DE Premier Cup%',
  'Pot Draw Test Cup%',
  'U12 Test Tournament%',
];

// Owner (organizer) email patterns (Postgres LIKE) identifying test accounts.
const DEFAULT_EMAIL_PATTERNS = [
  'test.%@sport.ro',
  '%@test.com',
  '%@tournament-test.com',
  '%@lead.test',
  '%@example.com',
];

interface CliOptions {
  apply: boolean;
  deleteTestUsers: boolean;
  namePatterns: string[];
  emailPatterns: string[];
}

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    deleteTestUsers: false,
    namePatterns: [...DEFAULT_NAME_PATTERNS],
    emailPatterns: [...DEFAULT_EMAIL_PATTERNS],
  };
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--delete-test-users') options.deleteTestUsers = true;
    else if (arg.startsWith('--name-like='))
      options.namePatterns.push(arg.slice('--name-like='.length));
    else if (arg.startsWith('--email-like='))
      options.emailPatterns.push(arg.slice('--email-like='.length));
  }
  return options;
}

async function connect(): Promise<DataSource> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  const sslMode = new URL(databaseUrl).searchParams.get('sslmode');
  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
    // Never alter schema from a cleanup script.
    synchronize: false,
    logging: false,
    ssl:
      sslMode === 'disable' || sslMode === 'false'
        ? false
        : { rejectUnauthorized: false },
  });
  await dataSource.initialize();
  return dataSource;
}

interface MatchedTournament {
  id: string;
  name: string;
  reason: string;
}

async function findMatches(
  ds: DataSource,
  options: CliOptions,
): Promise<{
  tournaments: MatchedTournament[];
  leadCount: number;
  testUsers: { id: string; email: string }[];
}> {
  // Tournaments matched by name pattern.
  const byName: { id: string; name: string }[] = await ds.query(
    `SELECT id, name FROM tournaments WHERE name ILIKE ANY($1::text[])`,
    [options.namePatterns],
  );

  // Tournaments matched by a test-owner email (excluding protected accounts).
  const byEmail: { id: string; name: string }[] = await ds.query(
    `SELECT t.id, t.name
       FROM tournaments t
       JOIN users u ON u.id = t.organizer_id
      WHERE u.email LIKE ANY($1::text[])
        AND u.email <> ALL($2::text[])`,
    [options.emailPatterns, PROTECTED_EMAILS],
  );

  const map = new Map<string, MatchedTournament>();
  for (const t of byName) map.set(t.id, { ...t, reason: 'name' });
  for (const t of byEmail) {
    const existing = map.get(t.id);
    if (existing) existing.reason = 'name+email';
    else map.set(t.id, { ...t, reason: 'email' });
  }
  const tournaments = [...map.values()];
  const ids = tournaments.map((t) => t.id);

  // Leads tied to those tournaments, or matching the dummy name patterns.
  const leadRows: { count: number }[] = await ds.query(
    `SELECT COUNT(*)::int AS count FROM leads
      WHERE ($1::uuid[] IS NOT NULL AND tournament_id = ANY($1::uuid[]))
         OR tournament_name ILIKE ANY($2::text[])`,
    [ids.length ? ids : null, options.namePatterns],
  );
  const leadCount = leadRows[0]?.count ?? 0;

  const testUsers: { id: string; email: string }[] = await ds.query(
    `SELECT id, email FROM users
      WHERE email LIKE ANY($1::text[]) AND email <> ALL($2::text[])
      ORDER BY email`,
    [options.emailPatterns, PROTECTED_EMAILS],
  );

  return { tournaments, leadCount, testUsers };
}

async function main(options: CliOptions): Promise<void> {
  console.log('🧹 Cleanup dummy data');
  console.log(`   mode: ${options.apply ? 'APPLY (will delete)' : 'DRY RUN'}`);
  console.log(`   name patterns: ${options.namePatterns.join(', ')}`);
  console.log(`   email patterns: ${options.emailPatterns.join(', ')}\n`);

  const ds = await connect();
  try {
    const { tournaments, leadCount, testUsers } = await findMatches(
      ds,
      options,
    );

    console.log(`Matched ${tournaments.length} tournament(s):`);
    for (const t of tournaments.slice(0, 40)) {
      console.log(`  - ${t.name}  [${t.reason}]`);
    }
    if (tournaments.length > 40) {
      console.log(`  … and ${tournaments.length - 40} more`);
    }
    console.log(`Leads to delete: ${leadCount}`);
    console.log(
      `Test users${options.deleteTestUsers ? ' to delete' : ' (found, not deleted)'}: ${testUsers.length}`,
    );

    if (!options.apply) {
      console.log('\n💡 Dry run only. Re-run with --apply to delete.');
      return;
    }
    if (
      tournaments.length === 0 &&
      leadCount === 0 &&
      !options.deleteTestUsers
    ) {
      console.log('\n✅ Nothing to delete.');
      return;
    }

    const ids = tournaments.map((t) => t.id);
    const runner = ds.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      // Leads first (tournament FK is SET NULL, so delete them explicitly).
      await runner.query(
        `DELETE FROM leads
          WHERE ($1::uuid[] IS NOT NULL AND tournament_id = ANY($1::uuid[]))
             OR tournament_name ILIKE ANY($2::text[])`,
        [ids.length ? ids : null, options.namePatterns],
      );

      // Tournaments (children cascade via FK onDelete: CASCADE).
      if (ids.length) {
        await runner.query(
          `DELETE FROM tournaments WHERE id = ANY($1::uuid[])`,
          [ids],
        );
      }

      // Optionally remove the test user accounts themselves.
      if (options.deleteTestUsers && testUsers.length) {
        await runner.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
          testUsers.map((u) => u.id),
        ]);
      }

      await runner.commitTransaction();
      console.log('');
      console.log(
        `🗑️  Deleted ${ids.length} tournament(s), ${leadCount} lead(s)` +
          (options.deleteTestUsers ? `, ${testUsers.length} user(s)` : ''),
      );
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  } finally {
    await ds.destroy();
  }
}

const cliOptions = parseCli(process.argv.slice(2));
main(cliOptions).catch((error) => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
