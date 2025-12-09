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

## Related Documentation

- [Getting Started](./GETTING_STARTED.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Reference](./API_REFERENCE.md)
