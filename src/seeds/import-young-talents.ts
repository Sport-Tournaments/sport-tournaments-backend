/**
 * Young Talents Group importer.
 *
 * Imports the youngtalentsgroup.com youth-football tournaments from a JSON
 * snapshot (collected out-of-band; see docs/SEEDING.md) into the database
 * using the platform's own data model:
 *   - a dedicated ORGANIZER user (created on first run)
 *   - `tournaments` (upserted by url_slug, so the import is idempotent)
 *   - `tournament_age_groups` (derived from the age categories, which encode
 *     birth year + game format, e.g. "2016 B10 (7vs7)")
 *
 * The source has no geo coordinates, so no `tournament_locations` are created
 * (that table requires latitude/longitude); the city/country live on the
 * tournament's `location` string instead.
 *
 * Usage:
 *   pnpm seed:youngtalents                     # import (needs DATABASE_URL)
 *   pnpm seed:youngtalents -- --dry-run        # parse + report, no DB writes
 *   pnpm seed:youngtalents -- --limit=5        # only first N (for testing)
 *   pnpm seed:youngtalents -- --file=path.json # override input file
 */
import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { TournamentStatus, Currency, UserRole } from '../common/enums';

config();

// ── Configuration ─────────────────────────────────────────

const ORGANIZER_EMAIL = 'import.youngtalentsgroup@turnee-sportive.ro';
const ORGANIZER_NAME = 'Young Talents Group';
const SLUG_PREFIX = 'young-talents-group';

/**
 * Resolve the default data file. Works both under ts-node (__dirname is
 * src/seeds) and compiled (__dirname is dist/seeds, where tsc does not copy
 * the .json — fall back to the source tree relative to the working dir).
 */
function defaultFile(): string {
  const candidates = [
    join(__dirname, 'data', 'young-talents-group.json'),
    join(process.cwd(), 'src', 'seeds', 'data', 'young-talents-group.json'),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

// ── Source data shape (matches the exported JSON) ─────────

interface SourceTournament {
  slug: string;
  sourceUrl?: string;
  name?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  venueName?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  countryCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  organiserNames?: string[];
  ageCategories?: string[];
  gender?: string | null;
  maxTeams?: number | null;
  firstEdition?: number | null;
  availability?: string | null;
  participationFee?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
}

interface CliOptions {
  dryRun: boolean;
  limit?: number;
  file: string;
}

// ── Local helpers (avoid seeds/utils/helpers → faker devDependency) ──

function generateUUID(): string {
  return randomUUID();
}

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Age-category parsing ──────────────────────────────────

export interface ParsedAgeGroup {
  birthYear: number;
  gameSystem: string;
  displayLabel: string;
}

/**
 * Parse a Young Talents age-category string into an age group.
 *
 * Formats seen in the data (case-insensitive):
 *   "2016 B10 (7vs7)"  → year 2016, boys, U10, 7-a-side
 *   "B14 (11vs11)"     → boys, U14, 11-a-side (year derived from event)
 *   "2015 B9"          → year 2015, boys, U9 (no format)
 *   "G17 (11vs11)"     → girls, U17
 *   "M-Open (7vs7)"    → open/senior (no age → skipped, no birth year)
 *
 * @returns the parsed age group, or null when no birth year can be derived.
 */
export function parseAgeCategory(
  raw: string,
  eventYear: number | undefined,
): ParsedAgeGroup | null {
  const text = raw.trim();

  // Optional leading 4-digit birth year.
  const yearMatch = /^(\d{4})\b/.exec(text);
  const leadingYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
  const rest = yearMatch ? text.slice(yearMatch[0].length).trim() : text;

  // Game format "(NvsN)" → "(N-1)+1"; ignore stray "(2014)" style noise.
  let gameSystem: string | undefined;
  const fmtMatch = /\((\d{1,2})\s*vs\s*\d{1,2}\)/i.exec(text);
  if (fmtMatch) {
    const perSide = parseInt(fmtMatch[1], 10);
    if (perSide >= 4 && perSide <= 11) gameSystem = `${perSide - 1}+1`;
  }

  // Gender code + age, e.g. "B10", "G17", "F9", "M-Open".
  const codeMatch = /\b([BGMF])-?(\d{1,2})\b/i.exec(rest);
  const age = codeMatch ? parseInt(codeMatch[2], 10) : undefined;

  let birthYear: number | undefined = leadingYear;
  if (birthYear === undefined && age !== undefined && eventYear !== undefined) {
    birthYear = eventYear - age;
  }
  if (birthYear === undefined) return null; // e.g. "M-Open" with no year

  // Fallback game system from age when no format was given.
  if (!gameSystem && age !== undefined) gameSystem = gameSystemForAge(age);
  if (!gameSystem) gameSystem = '10+1';

  return { birthYear, gameSystem, displayLabel: text };
}

function gameSystemForAge(age: number): string {
  if (age <= 8) return '4+1';
  if (age <= 10) return '6+1';
  if (age <= 12) return '8+1';
  return '10+1';
}

// ── Mapping helpers ───────────────────────────────────────

function deriveStatus(
  start?: string | null,
  end?: string | null,
): TournamentStatus {
  const today = toDateString(new Date());
  if (end && end < today) return TournamentStatus.COMPLETED;
  if (start && start <= today && (!end || end >= today))
    return TournamentStatus.ONGOING;
  return TournamentStatus.PUBLISHED;
}

function normalizeCurrency(raw?: string | null): Currency {
  const code = (raw || '').toUpperCase();
  if (code === 'GBP') return Currency.GBP;
  if (code === 'USD') return Currency.USD;
  if (code === 'RON') return Currency.RON;
  return Currency.EUR;
}

function isSoldOut(availability?: string | null): boolean {
  if (!availability) return false;
  return /sold\s*out|registration[\s_]*closed|not available|full|closed/i.test(
    availability,
  );
}

function buildDescription(t: SourceTournament): string {
  const parts = [t.shortDescription, t.description].filter(Boolean) as string[];
  if (t.sourceUrl) parts.push(`Source: ${t.sourceUrl}`);
  return parts.join('\n\n');
}

// ── Database import ───────────────────────────────────────

async function ensureOrganizer(dataSource: DataSource): Promise<string> {
  const users: Repository<Record<string, unknown>> =
    dataSource.getRepository('User');
  const existing = await users.findOne({ where: { email: ORGANIZER_EMAIL } });
  if (existing) return existing.id as string;

  const id = generateUUID();
  await users.insert({
    id,
    email: ORGANIZER_EMAIL,
    // Random unguessable password: data-ownership stub, not a login account.
    password: await hashPassword(generateUUID()),
    firstName: 'Young Talents',
    lastName: 'Import',
    country: 'Spain',
    role: UserRole.ORGANIZER,
    isActive: true,
    isVerified: true,
    organizationName: ORGANIZER_NAME,
  });
  console.log(`👤 Created organizer user ${ORGANIZER_EMAIL}`);
  return id;
}

async function importTournament(
  dataSource: DataSource,
  organizerId: string,
  t: SourceTournament,
): Promise<'inserted' | 'updated' | 'skipped'> {
  const name = (t.name || '').trim();
  if (!name || !t.slug) return 'skipped';

  const tournaments = dataSource.getRepository('Tournament');
  const ageGroups = dataSource.getRepository('TournamentAgeGroup');

  const urlSlug = `${SLUG_PREFIX}-${t.slug}`;
  const country = t.country || undefined;
  const locationStr =
    [t.streetAddress, t.city, country].filter(Boolean).join(', ') || name;
  const status = deriveStatus(t.startDate, t.endDate);
  const soldOut = isSoldOut(t.availability);
  const gender = (t.gender || '').toLowerCase();
  const isGirls = gender === 'girls';

  const tournamentValues = {
    name,
    organizer: { id: organizerId },
    description: buildDescription(t),
    status,
    startDate: t.startDate || undefined,
    endDate: t.endDate || undefined,
    location: locationStr,
    maxTeams: t.maxTeams ?? undefined,
    currency: normalizeCurrency(t.currency),
    participationFee: t.participationFee ?? 0,
    isPublished: true,
    isPremium: false,
    isFeatured: false,
    isPrivate: false,
    isRegistrationClosed: soldOut,
    tags: [
      'young-talents-group',
      'international',
      'youth',
      ...(gender ? [gender] : []),
      ...(isGirls ? ['girls'] : []),
      ...(country ? [country.toLowerCase()] : []),
    ],
    country,
    brochureUrl: t.imageUrl || undefined,
    urlSlug,
  };

  const existing = await tournaments.findOne({ where: { urlSlug } });
  let tournamentId: string;
  let action: 'inserted' | 'updated';

  if (existing) {
    tournamentId = existing.id as string;
    await tournaments.update({ id: tournamentId }, tournamentValues);
    await ageGroups.delete({ tournamentId }); // replace children on re-run
    action = 'updated';
  } else {
    tournamentId = generateUUID();
    await tournaments.insert({ id: tournamentId, ...tournamentValues });
    action = 'inserted';
  }

  // ── Age groups (require a start date and a unique birth year) ──
  const startDate = t.startDate || undefined;
  if (startDate) {
    const eventYear = parseInt(startDate.slice(0, 4), 10);
    const seenBirthYears = new Set<number>();

    for (const category of t.ageCategories || []) {
      const parsed = parseAgeCategory(category, eventYear);
      if (!parsed) continue;
      // (tournament_id, birth_year) is unique — dedupe e.g. B14 + G14.
      if (seenBirthYears.has(parsed.birthYear)) continue;
      seenBirthYears.add(parsed.birthYear);

      await ageGroups.insert({
        id: generateUUID(),
        tournament: { id: tournamentId },
        birthYear: parsed.birthYear,
        displayLabel: parsed.displayLabel,
        gameSystem: parsed.gameSystem,
        teamCount: 16,
        minTeams: 4,
        teamsPerGroup: 4,
        currentTeams: 0,
        startDate,
        endDate: t.endDate || startDate,
        isRegistrationClosed: soldOut,
        drawCompleted: false,
      });
    }
  }

  return action;
}

// ── Entry point ───────────────────────────────────────────

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, file: defaultFile() };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--limit='))
      options.limit = parseInt(arg.slice(8), 10);
    else if (arg.startsWith('--file=')) options.file = arg.slice(7);
  }
  return options;
}

function loadSource(file: string): SourceTournament[] {
  if (!existsSync(file)) {
    console.error(`❌ Input file not found: ${file}`);
    process.exit(1);
  }
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    console.error('❌ Input file must be a JSON array of tournaments.');
    process.exit(1);
  }
  return parsed as SourceTournament[];
}

async function connect(): Promise<DataSource> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      '❌ DATABASE_URL environment variable is required (or use --dry-run).',
    );
    process.exit(1);
  }
  const sslMode = new URL(databaseUrl).searchParams.get('sslmode');
  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
    synchronize: true,
    logging: process.env.DATABASE_LOGGING === 'true',
    ssl:
      sslMode === 'disable' || sslMode === 'false'
        ? false
        : { rejectUnauthorized: false },
  });
  await dataSource.initialize();
  return dataSource;
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));

  console.log('🌍 Importing Young Talents Group tournaments');
  console.log(`   file: ${options.file}${options.dryRun ? ' | DRY RUN' : ''}`);

  let source = loadSource(options.file);
  if (options.limit) source = source.slice(0, options.limit);
  console.log(`   ${source.length} tournaments in source\n`);

  if (options.dryRun) {
    let withName = 0;
    let ageGroupTotal = 0;
    let noDate = 0;
    for (const t of source) {
      if (!t.name) continue;
      withName++;
      if (!t.startDate) noDate++;
      const eventYear = t.startDate
        ? parseInt(t.startDate.slice(0, 4), 10)
        : undefined;
      const seen = new Set<number>();
      for (const c of t.ageCategories || []) {
        const p = parseAgeCategory(c, eventYear);
        if (p && !seen.has(p.birthYear)) {
          seen.add(p.birthYear);
          ageGroupTotal++;
        }
      }
    }
    console.log(
      `✅ Would import ${withName} tournaments (${source.length - withName} skipped: no name)`,
    );
    console.log(
      `   ${noDate} have no start date (age groups skipped for those)`,
    );
    console.log(`   ${ageGroupTotal} age groups total`);
    return;
  }

  const dataSource = await connect();
  try {
    const organizerId = await ensureOrganizer(dataSource);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (let i = 0; i < source.length; i++) {
      try {
        const action = await importTournament(
          dataSource,
          organizerId,
          source[i],
        );
        if (action === 'inserted') inserted++;
        else if (action === 'updated') updated++;
        else skipped++;
      } catch (error) {
        skipped++;
        console.warn(
          `  ⚠ [${i + 1}/${source.length}] ${source[i]?.slug}: ${(error as Error).message}`,
        );
      }
    }
    console.log('');
    console.log(
      `🏆 Done: ${inserted} inserted, ${updated} updated, ${skipped} skipped`,
    );
    console.log(`   Organizer: ${ORGANIZER_EMAIL}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
