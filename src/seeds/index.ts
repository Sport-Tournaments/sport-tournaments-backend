import { DataSource } from 'typeorm';
import { seedUsers } from './seeders/users.seed';
import { seedClubs } from './seeders/clubs.seed';
import { seedTournaments } from './seeders/tournaments.seed';
import { seedRegistrations } from './seeders/registrations.seed';
import { seedGroups } from './seeders/groups.seed';
import { seedPayments } from './seeders/payments.seed';
import { seedNotifications } from './seeders/notifications.seed';
import { seedInvitations } from './seeders/invitations.seed';
import { UserRole } from '../common/enums';

export interface SeedResult {
  users: number;
  clubs: number;
  tournaments: number;
  registrations: number;
  groups: number;
  payments: number;
  notifications: number;
  invitations: number;
}

export async function clearDatabase(dataSource: DataSource): Promise<void> {
  console.log('🗑️  Clearing existing data...');

  // Order matters due to foreign key constraints
  const entities = [
    'Payment',
    'Notification',
    'TournamentInvitation',
    'Group',
    'Registration',
    'Tournament',
    'Club',
    'RefreshToken',
    'User',
  ];

  const isPostgres = dataSource.options.type === 'postgres';

  // Disable foreign key checks for clean truncation
  if (isPostgres) {
    // PostgreSQL: use TRUNCATE CASCADE
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
    // MySQL: disable foreign key checks
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

    // Re-enable foreign key checks
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log('');
}

export async function runSeeder(dataSource: DataSource): Promise<SeedResult> {
  console.log('');
  console.log('🌱 Starting database seeding...');
  console.log('================================');
  console.log('');

  // Clear existing data
  await clearDatabase(dataSource);

  console.log('📝 Seeding data...');
  console.log('');

  // 1. Seed Users (60 users: 10 admin, 20 organizer, 30 participant)
  const users = await seedUsers(dataSource);
  const organizerIds = users
    .filter((u) => u.role === UserRole.ORGANIZER)
    .map((u) => u.id);
  const participantIds = users
    .filter((u) => u.role === UserRole.PARTICIPANT)
    .map((u) => u.id);
  const allUserIds = users.map((u) => u.id);

  // 2. Seed Clubs (100+ clubs)
  const clubs = await seedClubs(dataSource, organizerIds, participantIds);

  // 3. Seed Tournaments (100 tournaments)
  const tournaments = await seedTournaments(dataSource, organizerIds);

  // Create tournament names map for notifications
  const tournamentNames = new Map<string, string>();
  tournaments.forEach((t) => tournamentNames.set(t.id, t.name));

  // 4. Seed Registrations (200+ registrations)
  const registrations = await seedRegistrations(
    dataSource,
    tournaments.map((t) => ({
      id: t.id,
      status: t.status,
      organizerId: t.organizerId,
      fee: t.fee,
    })),
    clubs.map((c) => ({ id: c.id, ownerId: c.ownerId })),
  );

  // Create registrations by tournament map for groups
  const registrationsByTournament = new Map<
    string,
    { clubId: string; status: string }[]
  >();
  registrations.forEach((r) => {
    if (!registrationsByTournament.has(r.tournamentId)) {
      registrationsByTournament.set(r.tournamentId, []);
    }
    registrationsByTournament.get(r.tournamentId)!.push({
      clubId: r.clubId,
      status: r.status,
    });
  });

  // 5. Seed Groups (for tournaments with draw completed)
  const groups = await seedGroups(
    dataSource,
    tournaments.map((t) => ({
      id: t.id,
      status: t.status,
      drawCompleted: t.drawCompleted,
    })),
    registrationsByTournament,
  );

  // 6. Seed Payments (150+ payments)
  const payments = await seedPayments(
    dataSource,
    registrations.map((r) => ({
      id: r.id,
      clubId: r.clubId,
      tournamentId: r.tournamentId,
      userId: clubs.find((c) => c.id === r.clubId)?.ownerId || organizerIds[0],
      paymentStatus: r.paymentStatus,
      fee: tournaments.find((t) => t.id === r.tournamentId)?.fee || 200,
    })),
  );

  // 7. Seed Notifications (500+ notifications)
  const notifications = await seedNotifications(
    dataSource,
    allUserIds,
    tournamentNames,
  );

  // 8. Seed Invitations (150+ invitations)
  const invitations = await seedInvitations(
    dataSource,
    tournaments.map((t) => ({
      id: t.id,
      organizerId: t.organizerId,
      status: t.status,
    })),
    clubs.map((c) => ({
      id: c.id,
      ownerId: c.ownerId,
    })),
  );

  const result: SeedResult = {
    users: users.length,
    clubs: clubs.length,
    tournaments: tournaments.length,
    registrations: registrations.length,
    groups: groups.length,
    payments: payments.length,
    notifications: notifications.length,
    invitations: invitations.length,
  };

  console.log('');
  console.log('================================');
  console.log('✅ Seeding completed!');
  console.log('================================');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   Users:         ${result.users}`);
  console.log(`   Clubs:         ${result.clubs}`);
  console.log(`   Tournaments:   ${result.tournaments}`);
  console.log(`   Registrations: ${result.registrations}`);
  console.log(`   Groups:        ${result.groups}`);
  console.log(`   Payments:      ${result.payments}`);
  console.log(`   Notifications: ${result.notifications}`);
  console.log(`   Invitations:   ${result.invitations}`);
  console.log('');
  console.log(
    `   Total records: ${Object.values(result).reduce((a, b) => a + b, 0)}`,
  );
  console.log('');

  return result;
}
