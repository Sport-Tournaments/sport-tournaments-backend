import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
  RegistrationStatus,
  PaymentStatus,
  TournamentStatus,
} from '../../common/enums';
import {
  generateUUID,
  generateRomanianPhone,
  weightedRandom,
  shuffleArray,
} from '../utils/helpers';

export interface SeededRegistration {
  id: string;
  tournamentId: string;
  clubId: string;
  status: string;
  paymentStatus: string;
}

/**
 * Seed registrations table with realistic data
 * - Multiple registrations per tournament
 * - Mix of statuses: PENDING, APPROVED, REJECTED, WITHDRAWN
 */
export async function seedRegistrations(
  dataSource: DataSource,
  tournaments: {
    id: string;
    status: string;
    organizerId: string;
    fee: number;
  }[],
  clubs: { id: string; ownerId: string }[],
): Promise<SeededRegistration[]> {
  const registrationRepository = dataSource.getRepository('Registration');
  const tournamentRepository = dataSource.getRepository('Tournament');
  const seededRegistrations: SeededRegistration[] = [];
  const usedCombinations = new Set<string>();

  // Get tournaments that can have registrations (not DRAFT)
  const eligibleTournaments = tournaments.filter(
    (t) => t.status !== TournamentStatus.DRAFT,
  );

  for (const tournament of eligibleTournaments) {
    // Determine number of registrations based on tournament status
    let registrationCount: number;
    const maxTeams = faker.number.int({ min: 8, max: 24 }); // Approximate

    switch (tournament.status) {
      case TournamentStatus.PUBLISHED:
        registrationCount = faker.number.int({
          min: Math.floor(maxTeams * 0.3),
          max: Math.floor(maxTeams * 0.7),
        });
        break;
      case TournamentStatus.ONGOING:
      case TournamentStatus.COMPLETED:
        registrationCount = faker.number.int({
          min: Math.floor(maxTeams * 0.6),
          max: maxTeams,
        });
        break;
      default:
        registrationCount = faker.number.int({ min: 2, max: 6 });
    }

    // Shuffle clubs for random selection
    const shuffledClubs = shuffleArray([...clubs]);
    let addedCount = 0;
    let approvedCount = 0;

    for (const club of shuffledClubs) {
      if (addedCount >= registrationCount) break;

      const combinationKey = `${tournament.id}-${club.id}`;
      if (usedCombinations.has(combinationKey)) continue;

      // Skip if club owner is the tournament organizer
      if (club.ownerId === tournament.organizerId) continue;

      usedCombinations.add(combinationKey);

      // Determine registration status based on tournament status
      let status: RegistrationStatus;
      let paymentStatus: PaymentStatus;

      if (
        tournament.status === TournamentStatus.ONGOING ||
        tournament.status === TournamentStatus.COMPLETED
      ) {
        status = weightedRandom([
          { value: RegistrationStatus.APPROVED, weight: 0.85 },
          { value: RegistrationStatus.WITHDRAWN, weight: 0.1 },
          { value: RegistrationStatus.REJECTED, weight: 0.05 },
        ]);
      } else {
        status = weightedRandom([
          { value: RegistrationStatus.APPROVED, weight: 0.5 },
          { value: RegistrationStatus.PENDING, weight: 0.35 },
          { value: RegistrationStatus.REJECTED, weight: 0.1 },
          { value: RegistrationStatus.WITHDRAWN, weight: 0.05 },
        ]);
      }

      // Payment status based on registration status
      if (status === RegistrationStatus.APPROVED) {
        paymentStatus = weightedRandom([
          { value: PaymentStatus.COMPLETED, weight: 0.9 },
          { value: PaymentStatus.PENDING, weight: 0.1 },
        ]);
      } else if (status === RegistrationStatus.PENDING) {
        paymentStatus = weightedRandom([
          { value: PaymentStatus.PENDING, weight: 0.7 },
          { value: PaymentStatus.COMPLETED, weight: 0.2 },
          { value: PaymentStatus.FAILED, weight: 0.1 },
        ]);
      } else {
        paymentStatus = weightedRandom([
          { value: PaymentStatus.PENDING, weight: 0.5 },
          { value: PaymentStatus.REFUNDED, weight: 0.3 },
          { value: PaymentStatus.FAILED, weight: 0.2 },
        ]);
      }

      // Group assignment for approved registrations
      const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const groupAssignment =
        status === RegistrationStatus.APPROVED &&
        (tournament.status === TournamentStatus.ONGOING ||
          tournament.status === TournamentStatus.COMPLETED)
          ? faker.helpers.arrayElement(groupLetters.slice(0, 4))
          : undefined;

      const id = generateUUID();
      const registrationDate = faker.date.recent({ days: 60 });

      await registrationRepository.insert({
        id,
        tournament: { id: tournament.id },
        club: { id: club.id },
        status,
        groupAssignment,
        numberOfPlayers: faker.number.int({ min: 10, max: 22 }),
        coachName: faker.person.fullName(),
        coachPhone: generateRomanianPhone(),
        emergencyContact: generateRomanianPhone(),
        notes: faker.datatype.boolean({ probability: 0.3 })
          ? faker.lorem.sentence()
          : undefined,
        paymentStatus,
        registrationDate,
        createdAt: registrationDate,
      });

      if (status === RegistrationStatus.APPROVED) {
        approvedCount++;
      }

      seededRegistrations.push({
        id,
        tournamentId: tournament.id,
        clubId: club.id,
        status,
        paymentStatus,
      });

      addedCount++;
    }

    // Update tournament's currentTeams count
    if (approvedCount > 0) {
      await tournamentRepository.update(tournament.id, {
        currentTeams: approvedCount,
      });
    }
  }

  console.log(`✅ Seeded ${seededRegistrations.length} registrations`);
  return seededRegistrations;
}
