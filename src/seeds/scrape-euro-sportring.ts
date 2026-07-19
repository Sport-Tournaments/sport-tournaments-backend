/**
 * Euro-Sportring tournament scraper & seeder.
 *
 * Crawls https://www.euro-sportring.com/en/international-football-tournaments/youth-football-tournaments
 * (all listing pages + each tournament detail page) and upserts the tournaments
 * into the database using the platform's own data model:
 *   - a dedicated ORGANIZER user (created on first run)
 *   - `tournaments` (upserted by url_slug, so the script is idempotent / re-runnable)
 *   - `tournament_age_groups` (derived from the age categories, e.g. U11/G15 → birth year)
 *   - `tournament_locations` (primary venue with real coordinates)
 *
 * Requests are throttled (default 1 req/sec, sequential) with retries and
 * exponential backoff so we stay polite to their servers.
 *
 * Usage:
 *   pnpm seed:eurosportring                  # scrape + insert (needs DATABASE_URL)
 *   pnpm seed:eurosportring -- --dry-run     # scrape only, write JSON, no DB writes
 *   pnpm seed:eurosportring -- --limit=5     # only first 5 tournaments (for testing)
 *   pnpm seed:eurosportring -- --delay=2000  # 2s between requests
 */
import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { config } from 'dotenv';
import { TournamentStatus, Currency, UserRole } from '../common/enums';
import { generateUUID, hashPassword, toDateString } from './utils/helpers';

config();

// ── Configuration ─────────────────────────────────────────

const BASE_URL = 'https://www.euro-sportring.com';
const LISTING_PATH =
  '/en/international-football-tournaments/youth-football-tournaments';
const USER_AGENT =
  'sport-tournaments-seeder/1.0 (+one-off data import; contact: admin@turnee-sportive.ro)';

const ORGANIZER_EMAIL = 'import.eurosportring@turnee-sportive.ro';
const ORGANIZER_NAME = 'Euro-Sportring';

const DEFAULTS = {
  delayMs: 1000, // pause between requests (throttling)
  timeoutMs: 20000, // per-request timeout
  maxRetries: 3, // retries per request with exponential backoff
  maxListingPages: 30, // hard safety cap for the pager loop
};

interface CliOptions {
  dryRun: boolean;
  limit?: number;
  delayMs: number;
  outFile?: string;
}

// ── Scraped data shape ────────────────────────────────────

export interface ScrapedTournament {
  slug: string;
  url: string;
  name: string;
  preface?: string;
  bodyText?: string;
  slogan?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  streetAddress?: string;
  locality?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  organiserNames: string[];
  ageCategories: string[]; // e.g. ["U11", "U12", "G15"]
  teamsQty?: number;
  firstEdition?: number;
  availability?: string; // e.g. "available", "sold out"
  imageUrl?: string;
}

// ── HTTP helpers (throttled fetch with retry) ─────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;

async function fetchPage(url: string, options: CliOptions): Promise<string> {
  for (let attempt = 1; attempt <= DEFAULTS.maxRetries; attempt++) {
    // Throttle: guarantee at least `delayMs` between request starts
    const wait = lastRequestAt + options.delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULTS.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        signal: controller.signal,
        redirect: 'follow',
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw new NonRetryableError(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (error) {
      if (error instanceof NonRetryableError) throw error;
      if (attempt === DEFAULTS.maxRetries) {
        throw new Error(
          `Failed to fetch ${url} after ${DEFAULTS.maxRetries} attempts: ${(error as Error).message}`,
        );
      }
      const backoff = options.delayMs * Math.pow(2, attempt); // 2s, 4s, 8s at 1s delay
      console.warn(
        `  ⚠ ${url} failed (${(error as Error).message}), retrying in ${backoff}ms...`,
      );
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('unreachable');
}

class NonRetryableError extends Error {}

// ── HTML parsing helpers ──────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the inner HTML of the first Drupal field block with the given machine name. */
function extractFieldBlock(
  html: string,
  fieldName: string,
): string | undefined {
  const idx = html.indexOf(`field--name-${fieldName}`);
  if (idx < 0) return undefined;
  // Rewind to the opening `<` of the containing tag so its full class
  // attribute is inside the window (some fields carry `field__item` on the
  // same element), then grab a generous window; extractors narrow it down.
  const tagStart = html.lastIndexOf('<', idx);
  return html.slice(tagStart < 0 ? idx : tagStart, idx + 4000);
}

function extractFieldItems(block: string | undefined): string[] {
  if (!block) return [];
  const items: string[] = [];
  // `field__item` can appear alone or at the end of a longer class list
  // (e.g. class="field field--name-field-slogan ... field__item"). The
  // negative lookahead excludes the plural `field__items` wrapper.
  const re =
    /class=["'][^"']*field__item(?![a-z])[^"']*["'][^>]*>([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const text = stripTags(m[1]);
    if (text) items.push(text);
  }
  return items;
}

/**
 * Extract the long tournament description. Several nodes on the page render a
 * `field--name-body` block (menu cards included), so take the longest one.
 */
function extractBodyText(html: string): string | undefined {
  let best = '';
  const re =
    /field--name-body field--type-text-with-summary[^"']*["'][^>]*>([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (text.length > best.length) best = text;
  }
  return best ? best.slice(0, 4000) : undefined;
}

function extractFirstFieldItem(
  html: string,
  fieldName: string,
): string | undefined {
  return extractFieldItems(extractFieldBlock(html, fieldName))[0];
}

interface JsonLdEvent {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: { url?: string };
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressCountry?: string;
    };
    geo?: { latitude?: string; longitude?: string };
  };
  organizer?: { name?: string | string[] };
}

/** Parse the schema.org SportsEvent JSON-LD block embedded on detail pages. */
function extractJsonLdEvent(html: string): JsonLdEvent | undefined {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]) as {
        '@graph'?: Array<{ '@type'?: string } & JsonLdEvent>;
      };
      const event = parsed['@graph']?.find((n) => n['@type'] === 'SportsEvent');
      if (event) return event;
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return undefined;
}

// ── Listing crawl ─────────────────────────────────────────

/** Collect unique tournament detail URLs from all listing pages. */
async function crawlListing(options: CliOptions): Promise<string[]> {
  const slugs = new Set<string>();

  for (let page = 0; page < DEFAULTS.maxListingPages; page++) {
    const url =
      page === 0
        ? `${BASE_URL}${LISTING_PATH}`
        : `${BASE_URL}${LISTING_PATH}?page=${page}`;
    console.log(`📄 Listing page ${page + 1}: ${url}`);
    const html = await fetchPage(url, options);

    // Teaser cards link to the tournament detail page (e.g. href="/en/brabant-open")
    const cardRe =
      /node--type-tournament[^"]*node--view-mode-teaser[\s\S]*?href="(\/en\/[^"?#]+)"/g;
    let found = 0;
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(html)) !== null) {
      if (!slugs.has(m[1])) found++;
      slugs.add(m[1]);
    }

    console.log(`   → ${found} new tournaments (total ${slugs.size})`);

    // Stop when there is no "next page" link in the pager
    const hasNext = /rel="next"/.test(html);
    if (!hasNext || found === 0) break;
  }

  return [...slugs];
}

// ── Detail page scrape ────────────────────────────────────

async function scrapeTournament(
  path: string,
  options: CliOptions,
): Promise<ScrapedTournament | undefined> {
  const url = `${BASE_URL}${path}`;
  const html = await fetchPage(url, options);

  const event = extractJsonLdEvent(html);
  // Pages without a SportsEvent JSON-LD (or without a date) are dead links /
  // promo pages that redirect to the homepage — not actual tournaments.
  if (!event?.startDate) {
    console.warn(
      `  ⚠ No SportsEvent data on ${url}, skipping (not a tournament page?)`,
    );
    return undefined;
  }
  const name =
    event.name ?? stripTags(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '');
  if (!name) {
    console.warn(`  ⚠ Could not extract a name from ${url}, skipping`);
    return undefined;
  }

  const organiserRaw = event?.organizer?.name;
  const organiserNames = Array.isArray(organiserRaw)
    ? organiserRaw
    : organiserRaw
      ? [organiserRaw]
      : [];

  const ageCategories = extractFieldItems(
    extractFieldBlock(html, 'field-tournament-age-categories'),
  ).filter((v) => /^[UG]\d{1,2}$/i.test(v));

  const teamsQtyStr = extractFirstFieldItem(html, 'field-tournament-teams-qty');
  const firstEditionStr = extractFirstFieldItem(html, 'field-first-edition');
  const availability = extractFirstFieldItem(
    html,
    'field-tournament-availability',
  )?.toLowerCase();
  const slogan = extractFirstFieldItem(html, 'field-slogan');
  const preface =
    event?.description ??
    extractFirstFieldItem(html, 'field-tournament-preface');

  // Long description from the body field
  const bodyText = extractBodyText(html);

  const lat = event?.location?.geo?.latitude;
  const lng = event?.location?.geo?.longitude;

  return {
    slug: path.replace(/^\/en\//, ''),
    url,
    name: stripTags(name),
    preface,
    bodyText: bodyText || undefined,
    slogan,
    startDate: event?.startDate,
    endDate: event?.endDate,
    streetAddress: event?.location?.address?.streetAddress,
    locality:
      event?.location?.address?.addressLocality ?? event?.location?.name,
    countryCode: event?.location?.address?.addressCountry,
    latitude: lat ? parseFloat(lat) : undefined,
    longitude: lng ? parseFloat(lng) : undefined,
    organiserNames,
    ageCategories: [...new Set(ageCategories.map((c) => c.toUpperCase()))],
    teamsQty: teamsQtyStr ? parseInt(teamsQtyStr, 10) || undefined : undefined,
    firstEdition: firstEditionStr
      ? parseInt(firstEditionStr, 10) || undefined
      : undefined,
    availability,
    imageUrl: event?.image?.url,
  };
}

// ── Mapping helpers (site data → our data model) ──────────

const COUNTRY_NAMES: Record<string, string> = {
  NL: 'Netherlands',
  BE: 'Belgium',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  IT: 'Italy',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  DK: 'Denmark',
  AT: 'Austria',
  CH: 'Switzerland',
  CZ: 'Czech Republic',
  PL: 'Poland',
  PT: 'Portugal',
  HR: 'Croatia',
  SI: 'Slovenia',
  SE: 'Sweden',
  NO: 'Norway',
  IE: 'Ireland',
  LU: 'Luxembourg',
  HU: 'Hungary',
  RO: 'Romania',
};

function countryName(code?: string): string | undefined {
  if (!code) return undefined;
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

/** Game system by age, mirroring the convention used in tournament-age-groups.seed.ts */
function gameSystemForAge(age: number): string {
  if (age <= 9) return '5+1';
  if (age <= 11) return '7+1';
  if (age <= 13) return '9+1';
  return '10+1';
}

function deriveStatus(start?: string, end?: string): TournamentStatus {
  const today = toDateString(new Date());
  if (end && end < today) return TournamentStatus.COMPLETED;
  if (start && start <= today && (!end || end >= today))
    return TournamentStatus.ONGOING;
  return TournamentStatus.PUBLISHED;
}

function buildDescription(t: ScrapedTournament): string {
  const parts = [t.preface, t.bodyText].filter(Boolean);
  parts.push(`Source: ${t.url}`);
  return parts.join('\n\n');
}

// ── Database seeding ──────────────────────────────────────

async function ensureOrganizer(dataSource: DataSource): Promise<string> {
  const users: Repository<Record<string, unknown>> =
    dataSource.getRepository('User');
  const existing = await users.findOne({ where: { email: ORGANIZER_EMAIL } });
  if (existing) return existing.id as string;

  const id = generateUUID();
  await users.insert({
    id,
    email: ORGANIZER_EMAIL,
    // Random unguessable password: this account is a data-ownership stub, not a login
    password: await hashPassword(generateUUID()),
    firstName: 'Euro-Sportring',
    lastName: 'Import',
    country: 'Netherlands',
    role: UserRole.ORGANIZER,
    isActive: true,
    isVerified: true,
    organizationName: ORGANIZER_NAME,
  });
  console.log(`👤 Created organizer user ${ORGANIZER_EMAIL}`);
  return id;
}

async function seedTournament(
  dataSource: DataSource,
  organizerId: string,
  t: ScrapedTournament,
): Promise<'inserted' | 'updated'> {
  const tournaments = dataSource.getRepository('Tournament');
  const ageGroups = dataSource.getRepository('TournamentAgeGroup');
  const locations = dataSource.getRepository('TournamentLocation');

  const urlSlug = `euro-sportring-${t.slug}`;
  const country = countryName(t.countryCode);
  const locationStr = [t.streetAddress, t.locality, country]
    .filter(Boolean)
    .join(', ');
  const status = deriveStatus(t.startDate, t.endDate);
  const isGirls = t.ageCategories.some((c) => c.startsWith('G'));
  const soldOut =
    !!t.availability && /sold\s*out|full|closed/i.test(t.availability);

  const tournamentValues = {
    name: t.name,
    organizer: { id: organizerId },
    description: buildDescription(t),
    status,
    startDate: t.startDate,
    endDate: t.endDate,
    location: locationStr || t.name,
    latitude: t.latitude,
    longitude: t.longitude,
    maxTeams: t.teamsQty,
    currency: Currency.EUR,
    participationFee: 0,
    isPublished: true,
    isPremium: false,
    isFeatured: false,
    isPrivate: false,
    isRegistrationClosed: soldOut,
    tags: [
      'euro-sportring',
      'international',
      'youth',
      ...(isGirls ? ['girls'] : []),
      ...(country ? [country.toLowerCase()] : []),
    ],
    contactEmail: undefined as string | undefined,
    country,
    brochureUrl: t.imageUrl,
    urlSlug,
  };

  const existing = await tournaments.findOne({ where: { urlSlug } });
  let tournamentId: string;
  let action: 'inserted' | 'updated';

  if (existing) {
    tournamentId = existing.id as string;
    await tournaments.update({ id: tournamentId }, tournamentValues);
    // Replace children so re-runs stay in sync with the site
    await ageGroups.delete({ tournamentId });
    await locations.delete({ tournamentId });
    action = 'updated';
  } else {
    tournamentId = generateUUID();
    await tournaments.insert({ id: tournamentId, ...tournamentValues });
    action = 'inserted';
  }

  // ── Age groups: U11 → birth year = event year - 11 ──
  const eventYear = t.startDate
    ? parseInt(t.startDate.slice(0, 4), 10)
    : new Date().getFullYear();
  const seenBirthYears = new Set<number>();

  for (const category of t.ageCategories) {
    const age = parseInt(category.slice(1), 10);
    if (!age || age < 5 || age > 23) continue;
    const birthYear = eventYear - age;
    // (tournament_id, birth_year) is unique — U13 + G13 share a birth year
    if (seenBirthYears.has(birthYear)) continue;
    seenBirthYears.add(birthYear);

    await ageGroups.insert({
      id: generateUUID(),
      tournament: { id: tournamentId },
      birthYear,
      displayLabel: category,
      gameSystem: gameSystemForAge(age),
      teamCount: 16,
      minTeams: 4,
      teamsPerGroup: 4,
      currentTeams: 0,
      startDate: t.startDate,
      endDate: t.endDate ?? t.startDate,
      isRegistrationClosed: soldOut,
      drawCompleted: false,
    });
  }

  // ── Primary venue ──
  if (t.latitude !== undefined && t.longitude !== undefined) {
    await locations.insert({
      id: generateUUID(),
      tournament: { id: tournamentId },
      venueName: t.locality ?? t.name,
      latitude: t.latitude,
      longitude: t.longitude,
      address: locationStr,
      city: t.locality,
      country,
      fieldCount: 1,
      displayOrder: 0,
      isPrimary: true,
    });
  }

  return action;
}

// ── Entry point ───────────────────────────────────────────

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, delayMs: DEFAULTS.delayMs };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--limit='))
      options.limit = parseInt(arg.slice(8), 10);
    else if (arg.startsWith('--delay='))
      options.delayMs = parseInt(arg.slice(8), 10);
    else if (arg.startsWith('--out=')) options.outFile = arg.slice(6);
  }
  if (!Number.isFinite(options.delayMs) || options.delayMs < 250) {
    options.delayMs = DEFAULTS.delayMs; // never hammer the site
  }
  return options;
}

async function connect(): Promise<DataSource> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      '❌ DATABASE_URL environment variable is required (or use --dry-run to scrape without a database).',
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

  console.log('🌍 Scraping Euro-Sportring youth football tournaments');
  console.log(
    `   throttle: ${options.delayMs}ms/request${options.dryRun ? ' | DRY RUN (no DB writes)' : ''}`,
  );
  console.log('');

  // 1. Crawl all listing pages for detail URLs
  let paths = await crawlListing(options);
  if (options.limit) paths = paths.slice(0, options.limit);
  console.log(`\n🔗 ${paths.length} tournament pages to scrape\n`);

  // 2. Scrape each detail page (sequential + throttled)
  const scraped: ScrapedTournament[] = [];
  for (let i = 0; i < paths.length; i++) {
    try {
      const t = await scrapeTournament(paths[i], options);
      if (t) {
        scraped.push(t);
        console.log(
          `  [${i + 1}/${paths.length}] ${t.name} — ${t.startDate ?? 'no date'} — ${t.locality ?? '?'}, ${t.countryCode ?? '?'} — ${t.ageCategories.join('/') || 'no categories'}`,
        );
      }
    } catch (error) {
      console.warn(
        `  ⚠ [${i + 1}/${paths.length}] Skipping ${paths[i]}: ${(error as Error).message}`,
      );
    }
  }
  console.log(`\n✅ Scraped ${scraped.length}/${paths.length} tournaments`);

  // Optionally persist the raw scrape result
  if (options.outFile || options.dryRun) {
    const out = options.outFile ?? 'euro-sportring-scraped.json';
    writeFileSync(out, JSON.stringify(scraped, null, 2));
    console.log(`💾 Raw data written to ${out}`);
  }
  if (options.dryRun) return;

  // 3. Insert / update in the database
  const dataSource = await connect();
  try {
    const organizerId = await ensureOrganizer(dataSource);
    let inserted = 0;
    let updated = 0;
    for (const t of scraped) {
      const action = await seedTournament(dataSource, organizerId, t);
      if (action === 'inserted') inserted++;
      else updated++;
    }
    console.log('');
    console.log(
      `🏆 Done: ${inserted} tournaments inserted, ${updated} updated`,
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
