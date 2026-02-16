import { DataSource } from 'typeorm';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { seedUsers } from './seeders/users.seed';
import { seedClubs } from './seeders/clubs.seed';
import { seedTeams } from './seeders/teams.seed';
import { seedPlayers } from './seeders/players.seed';
import { seedTournaments } from './seeders/tournaments.seed';
import { seedTournamentLocations } from './seeders/tournament-locations.seed';
import { seedTournamentAgeGroups } from './seeders/tournament-age-groups.seed';
import { seedRegistrations } from './seeders/registrations.seed';
import { seedGroups } from './seeders/groups.seed';
import { seedTournamentPots } from './seeders/tournament-pots.seed';
import { seedPayments } from './seeders/payments.seed';
import { seedNotifications } from './seeders/notifications.seed';
import { seedInvitations } from './seeders/invitations.seed';
import { seedTranslations } from './seeders/translations.seed';
import { UserRole } from '../common/enums';

export interface SeedResult {
  users: number;
  clubs: number;
  teams: number;
  players: number;
  tournaments: number;
  tournamentLocations: number;
  tournamentAgeGroups: number;
  registrations: number;
  groups: number;
  tournamentPots: number;
  payments: number;
  notifications: number;
  invitations: number;
  translations: number;
}

export async function clearDatabase(dataSource: DataSource): Promise<void> {
  console.log('🗑️  Clearing existing data...');

  // Order matters due to foreign key constraints
  const entities = [
    'Translation',
    'TournamentPot',
    'Payment',
    'Notification',
    'TournamentInvitation',
    'RegistrationDocument',
    'Group',
    'Registration',
    'TournamentAgeGroup',
    'TournamentLocation',
    'Tournament',
    'Player',
    'Team',
    'Club',
    'RefreshToken',
    'User',
  ];

  const isPostgres = dataSource.options.type === 'postgres';

  if (isPostgres) {
    // Also clear join table
    try {
      await dataSource.query('TRUNCATE TABLE "team_players" CASCADE');
      console.log('  ✓ Cleared team_players');
    } catch { /* might not exist yet */ }

    for (const entity of entities) {
      try {
        const repository = dataSource.getRepository(entity);
        await repository.query(
          `TRUNCATE TABLE "${repository.metadata.tableName}" CASCADE`,
        );
        console.log(`  ✓ Cleared ${entity}`);
      } catch (error) {
        console.log(
          `  ⚠ Could not clear ${entity}: ${(error as Error).message}`,
        );
      }
    }
  } else {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const entity of entities) {
      try {
        const repository = dataSource.getRepository(entity);
        await repository.query(
          `TRUNCATE TABLE \`${repository.metadata.tableName}\``,
        );
        console.log(`  ✓ Cleared ${entity}`);
      } catch (error) {
        console.log(
          `  ⚠ Could not clear ${entity}: ${(error as Error).message}`,
        );
      }
    }
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log('');
}

export async function runSeeder(dataSource: DataSource): Promise<SeedResult> {
  console.log('');
  console.log('🌱 Starting database seeding...');
  console.log('================================');
  console.log('  Locale : RO (Romania)');
  console.log('  Dates  : Oct 2025 → Oct 2026');
  console.log('================================');
  console.log('');

  await clearDatabase(dataSource);

  console.log('📝 Seeding data...');
  console.log('');

  // 1. Users
  const users = await seedUsers(dataSource);
  const organizerIds = users.filter((u) => u.role === UserRole.ORGANIZER).map((u) => u.id);
  const participantIds = users.filter((u) => u.role === UserRole.PARTICIPANT).map((u) => u.id);
  const allUserIds = users.map((u) => u.id);

  // 2. Clubs
  const clubs = await seedClubs(dataSource, organizerIds, participantIds);

  // 3. Teams
  const teams = await seedTeams(
    dataSource,
    clubs.map((c) => ({ id: c.id, name: c.name })),
  );

  // 4. Players
  const players = await seedPlayers(
    dataSource,
    teams.map((t) => ({ id: t.id, birthyear: t.birthyear })),
  );

  // 5. Tournaments
  const tournaments = await seedTournaments(dataSource, organizerIds);

  // 6. Tournament Locations
  const tournamentLocations = await seedTournamentLocations(
    dataSource,
    tournaments.map((t) => t.id),
  );

  // 7. Tournament Age Groups
  const tournamentAgeGroups = await seedTournamentAgeGroups(
    dataSource,
    tournaments.map((t) => ({ id: t.id, startDate: t.startDate, endDate: t.endDate })),
  );

  // Tournament names map for notifications
  const tournamentNames = new Map<string, string>();
  tournaments.forEach((t) => tournamentNames.set(t.id, t.name));

  // 8. Registrations (now with teams)
  const registrations = await seedRegistrations(
    dataSource,
    tournaments.map((t) => ({
      id: t.id,
      status: t.status,
      organizerId: t.organizerId,
      fee: t.fee,
    })),
    clubs.map((c) => ({ id: c.id, ownerId: c.ownerId })),
    teams.map((t) => ({
      id: t.id,
      clubId: t.clubId,
      birthyear: t.birthyear,
      ageCategory: t.ageCategory,
    })),
  );

  // Registrations-by-tournament maps
  const registrationsByTournament = new Map<string, { clubId: string; status: string }[]>();
  const registrationsByTournamentFull = new Map<string, { id: string; status: string }[]>();
  registrations.forEach((r) => {
    if (!registrationsByTournament.has(r.tournamentId)) {
      registrationsByTournament.set(r.tournamentId, []);
      registrationsByTournamentFull.set(r.tournamentId, []);
    }
    registrationsByTournament.get(r.tournamentId)!.push({ clubId: r.clubId, status: r.status });
    registrationsByTournamentFull.get(r.tournamentId)!.push({ id: r.id, status: r.status });
  });

  // 9. Groups
  const groups = await seedGroups(
    dataSource,
    tournaments.map((t) => ({ id: t.id, status: t.status, drawCompleted: t.drawCompleted })),
    registrationsByTournament,
  );

  // 10. Tournament Pots
  const tournamentPots = await seedTournamentPots(
    dataSource,
    tournaments.map((t) => ({ id: t.id, drawCompleted: t.drawCompleted })),
    registrationsByTournamentFull,
  );

  // 11. Payments
  const payments = await seedPayments(
    dataSource,
    registrations.map((r) => ({
      id: r.id,
      clubId: r.clubId,
      tournamentId: r.tournamentId,
      userId: clubs.find((c) => c.id === r.clubId)?.ownerId || organizerIds[0],
      paymentStatus: r.paymentStatus,
      fee: tournaments.find((t) => t.id === r.tournamentId)?.fee || 500,
    })),
  );

  // 12. Notifications
  const notifications = await seedNotifications(dataSource, allUserIds, tournamentNames);

  // 13. Invitations
  const invitations = await seedInvitations(
    dataSource,
    tournaments.map((t) => ({ id: t.id, organizerId: t.organizerId, status: t.status })),
    clubs.map((c) => ({ id: c.id, ownerId: c.ownerId })),
  );

  // 14. Translations
  const translationCount = await seedTranslations(
    dataSource,
    tournaments.map((t) => ({ id: t.id, name: t.name })),
  );

  // ── Write credentials file ──
  const credLines = [
    '# 🔐 Seed User Credentials',
    '# Generated by pnpm seed — all passwords are pre-hashed in the DB',
    `# Date range: Oct 2025 → Oct 2026 | Locale: RO`,
    '',
    '## Admins',
    '| Email | Password | Role |',
    '|-------|----------|------|',
    ...users.filter((u) => u.role === UserRole.ADMIN).map(
      (u) => `| ${u.email} | ${u.password} | ADMIN |`,
    ),
    '',
    '## Organizers',
    '| Email | Password | Role | Name |',
    '|-------|----------|------|------|',
    ...users.filter((u) => u.role === UserRole.ORGANIZER).map(
      (u) => `| ${u.email} | ${u.password} | ORGANIZER | ${u.firstName} ${u.lastName} |`,
    ),
    '',
    '## Participants',
    '| Email | Password | Role | Name |',
    '|-------|----------|------|------|',
    ...users.filter((u) => u.role === UserRole.PARTICIPANT).map(
      (u) => `| ${u.email} | ${u.password} | PARTICIPANT | ${u.firstName} ${u.lastName} |`,
    ),
    '',
  ];

  const credPath = join(__dirname, '../../..', 'SEED_CREDENTIALS.md');
  writeFileSync(credPath, credLines.join('\n'), 'utf-8');
  console.log(`\n📄 Credentials saved to SEED_CREDENTIALS.md`);

  const result: SeedResult = {
    users: users.length,
    clubs: clubs.length,
    teams: teams.length,
    players: players.length,
    tournaments: tournaments.length,
    tournamentLocations: tournamentLocations.length,
    tournamentAgeGroups: tournamentAgeGroups.length,
    registrations: registrations.length,
    groups: groups.length,
    tournamentPots: tournamentPots.length,
    payments: payments.length,
    notifications: notifications.length,
    invitations: invitations.length,
    translations: translationCount,
  };

  console.log('');
  console.log('================================');
  console.log('✅ Seeding completed!');
  console.log('================================');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   Users:                ${result.users}`);
  console.log(`   Clubs:                ${result.clubs}`);
  console.log(`   Teams:                ${result.teams}`);
  console.log(`   Players:              ${result.players}`);
  console.log(`   Tournaments:          ${result.tournaments}`);
  console.log(`   Tournament Locations: ${result.tournamentLocations}`);
  console.log(`   Tournament Age Groups:${result.tournamentAgeGroups}`);
  console.log(`   Registrations:        ${result.registrations}`);
  console.log(`   Groups:               ${result.groups}`);
  console.log(`   Tournament Pots:      ${result.tournamentPots}`);
  console.log(`   Payments:             ${result.payments}`);
  console.log(`   Notifications:        ${result.notifications}`);
  console.log(`   Invitations:          ${result.invitations}`);
  console.log(`   Translations:         ${result.translations}`);
  console.log('');
  console.log(
    `   Total records: ${Object.values(result).reduce((a, b) => a + b, 0)}`,
  );
  console.log('');

  return result;
}
