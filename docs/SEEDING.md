# Database Seeding Guide

This guide explains how to use the database seeding system for the Football Tournament Platform.

## Quick Start

```bash
# Seed the database with test data
pnpm seed

# Or with development environment
pnpm seed:dev
```

## What Gets Seeded

The seeding system creates interconnected, realistic test data:

| Table | Records | Description |
|-------|---------|-------------|
| Users | 60 | 10 admins, 20 organizers, 30 participants |
| Clubs | ~100 | 3 per organizer + 1-2 per participant |
| Tournaments | 100 | 4 per organizer + 20 extra with varied statuses |
| Registrations | ~800 | Multiple per tournament with status distribution |
| Groups | ~170 | For tournaments with draw completed |
| Payments | ~750 | For registrations with payment activity |
| Notifications | ~600 | 8-12 per user across all types |
| Invitations | ~270 | 2-5 per eligible tournament |

**Total: ~2,800+ records**

## Data Characteristics

### Users
- **Admins**: `admin1@footballtournament.com` to `admin10@footballtournament.com`
- **Organizers**: `organizer1@example.com` to `organizer20@example.com`
- **Participants**: `participant1@example.com` to `participant30@example.com`
- **Default Password**: `Password123!` (Admin: `Admin123!`)

### Tournaments
Status distribution per organizer:
- 1 DRAFT (future, unpublished)
- 1 PUBLISHED (open for registration)
- 1 ONGOING (currently in progress)
- 1 COMPLETED (past tournament)

### Registrations
Status weights based on tournament status:
- ONGOING/COMPLETED: 85% APPROVED, 10% WITHDRAWN, 5% REJECTED
- PUBLISHED: 50% APPROVED, 35% PENDING, 10% REJECTED, 5% WITHDRAWN

### Payments
- COMPLETED registrations: 90% COMPLETED payment
- PENDING registrations: 70% PENDING, 20% COMPLETED, 10% FAILED
- Other statuses: 50% PENDING, 30% REFUNDED, 20% FAILED

### Groups
- Only created for tournaments with `drawCompleted = true`
- 2-8 groups based on team count
- Teams randomly distributed across groups

## File Structure

```
src/seeds/
├── index.ts              # Main seeder orchestrator
├── run.ts                # Entry point (CLI runner)
├── data/
│   └── locations.ts      # Romanian cities, countries, tournament names
├── utils/
│   └── helpers.ts        # UUID generation, password hashing, etc.
└── seeders/
    ├── index.ts          # Barrel export
    ├── users.seed.ts
    ├── clubs.seed.ts
    ├── tournaments.seed.ts
    ├── registrations.seed.ts
    ├── groups.seed.ts
    ├── payments.seed.ts
    ├── notifications.seed.ts
    └── invitations.seed.ts
```

## Seeding Order

Data is seeded in dependency order:
1. **Users** (no dependencies)
2. **Clubs** (depends on Users)
3. **Tournaments** (depends on Users)
4. **Registrations** (depends on Tournaments, Clubs)
5. **Groups** (depends on Tournaments, Registrations)
6. **Payments** (depends on Registrations)
7. **Notifications** (depends on Users)
8. **Invitations** (depends on Tournaments, Clubs)

## Clear Behavior

Running `pnpm seed`:
1. Disables foreign key checks
2. Truncates all tables in reverse dependency order
3. Re-enables foreign key checks
4. Seeds fresh data

**⚠️ Warning**: This will delete ALL existing data in the database.

## Environment Variables

The seeder uses these environment variables (with defaults):

```env
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3308
DATABASE_USER=football_user
DATABASE_PASSWORD=football_password
DATABASE_NAME=nest-app-opus
DATABASE_LOGGING=false
```

## Customization

### Adding More Records

Modify the loop counts in individual seeders:
- `users.seed.ts`: Change loop iterations for each role
- `clubs.seed.ts`: Adjust clubs per organizer/participant
- `tournaments.seed.ts`: Modify tournaments per organizer

### Adding New Data Types

1. Create a new seeder file in `src/seeds/seeders/`
2. Export the seeder function
3. Add to barrel export in `seeders/index.ts`
4. Import and call in `src/seeds/index.ts` in correct order

### Custom Data

Modify `src/seeds/data/locations.ts` for:
- Cities and countries
- Tournament name prefixes/suffixes
- Game systems
- Tags

## Troubleshooting

### Connection Issues
```
Error: connect ECONNREFUSED
```
- Ensure MySQL Docker container is running: `docker ps`
- Check port matches (default: 3308 external, 3306 internal)

### Foreign Key Errors
```
Cannot delete or update a parent row
```
- The seeder handles this with `SET FOREIGN_KEY_CHECKS = 0`
- If persists, manually run: `pnpm seed` again

### ES Module Warning
```
CommonJS module is loading ES Module using require()
```
- This is a warning from faker.js, not an error
- Can be safely ignored, seeding will proceed

## Real Data Import: Euro-Sportring

Besides the faker-based test seed, you can import **real tournaments** scraped
from [Euro-Sportring's youth football tournaments](https://www.euro-sportring.com/en/international-football-tournaments/youth-football-tournaments):

```bash
# Scrape + insert into the database (requires DATABASE_URL)
pnpm seed:eurosportring

# Scrape only — writes euro-sportring-scraped.json, no DB writes
pnpm seed:eurosportring -- --dry-run

# Useful flags
pnpm seed:eurosportring -- --limit=5        # only first N tournaments (testing)
pnpm seed:eurosportring -- --delay=2000     # ms between requests (default 1000, min 250)
pnpm seed:eurosportring -- --out=data.json  # also dump the raw scraped data
```

What it does:

1. Crawls **all listing pages** (Drupal `?page=N` pager) to collect every
   tournament detail URL (~56 tournaments).
2. Fetches **each tournament page** sequentially with throttling (1 req/sec by
   default), retries with exponential backoff, a request timeout, and an
   identifying User-Agent.
3. Parses the schema.org **SportsEvent JSON-LD** (name, description, dates,
   address, geo coordinates, organiser) plus page fields (age categories,
   team count, first edition, availability, slogan, long description).
4. Maps into our data model:
   - A dedicated organizer user `import.eurosportring@turnee-sportive.ro`
     (role ORGANIZER, created on first run).
   - `tournaments` — status derived from dates (PUBLISHED/ONGOING/COMPLETED),
     currency EUR, `max_teams` from their team count, `is_registration_closed`
     when sold out, real lat/long, `url_slug` = `euro-sportring-<slug>`.
   - `tournament_age_groups` — one per age category (U7–U19, G-categories for
     girls) with `birth_year` = event year − age and a game system matching the
     platform conventions (5+1 / 7+1 / 9+1 / 10+1 by age).
   - `tournament_locations` — the primary venue with address + coordinates.

The import is **idempotent**: tournaments are upserted by `url_slug`, so
re-running refreshes existing rows (and replaces their age groups/locations)
instead of duplicating them. It does **not** clear any other data — it composes
with `pnpm seed` or an empty database alike.

### Automatic run on production deploy

Production starts through `scripts/start-prod.sh` (wired into `nixpacks.toml`
and the `Dockerfile` CMD), which launches the compiled seeder
(`node dist/seeds/scrape-euro-sportring.js --on-deploy`) **in the background**
before starting the API. On every deploy the database is refreshed with the
current Euro-Sportring data. Safety properties in deploy mode:

- **Non-blocking**: the API starts immediately; the seed (~2 min) runs
  concurrently and a failed scrape can never fail the deployment (always
  exits 0).
- **Single-flight**: a Postgres advisory lock ensures only one replica seeds
  at a time; others skip.
- **Opt-out**: set `SEED_EUROSPORTRING_ON_DEPLOY=false` in the environment to
  disable it.

## Related Documentation

- [Getting Started](./GETTING_STARTED.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Reference](./API_REFERENCE.md)
