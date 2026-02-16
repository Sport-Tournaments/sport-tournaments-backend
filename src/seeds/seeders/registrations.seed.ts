import { DataSource } from 'typeorm';
import {
  RegistrationStatus,
  PaymentStatus,
  TournamentStatus,
} from '../../common/enums';
import {
  faker,
  generateUUID,
  generateRomanianPhone,
  weightedRandom,
  shuffleArray,
  seedDate,
} from '../utils/helpers';

export interface SeededRegistration {
  id: string;
  tournamentId: string;
  clubId: string;
  teamId?: string;
  status: string;
  paymentStatus: string;
}

/**
 * Seed registrations – links clubs/teams to tournaments.
 * Dates within Oct 2025 – Oct 2026.
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
  teams: { id: string; clubId: string; birthyear: number; ageCategory: string }[],
): Promise<SeededRegistration[]> {
  const registrationRepository = dataSource.getRepository('Registration');
  const tournamentRepository = dataSource.getRepository('Tournament');
  const tournamentAgeGroupRepository = dataSource.getRepository('TournamentAgeGroup');
  const seededRegistrations: SeededRegistration[] = [];
  const usedCombinations = new Set<string>();

  const eligibleTournaments = tournaments.filter(
    (t) => t.status !== TournamentStatus.DRAFT,
  );

  // Index age groups by tournament for optional category assignment
  const allTournamentAgeGroups = await tournamentAgeGroupRepository.find({
    select: ['id', 'tournamentId', 'birthYear', 'ageCategory'],
  });
  const ageGroupsByTournament = new Map<string, { id: string; tournamentId: string; birthYear: number; ageCategory?: string }[]>();
  for (const ageGroup of allTournamentAgeGroups) {
    if (!ageGroupsByTournament.has(ageGroup.tournamentId)) {
      ageGroupsByTournament.set(ageGroup.tournamentId, []);
    }
    ageGroupsByTournament.get(ageGroup.tournamentId)!.push({
      id: ageGroup.id,
      tournamentId: ageGroup.tournamentId,
      birthYear: ageGroup.birthYear,
      ageCategory: ageGroup.ageCategory,
    });
  }

  // Index teams by clubId for fast lookup
  const teamsByClub = new Map<string, { id: string; clubId: string; birthyear: number; ageCategory: string }[]>();
  for (const team of teams) {
    if (!teamsByClub.has(team.clubId)) teamsByClub.set(team.clubId, []);
    teamsByClub.get(team.clubId)!.push(team);
  }

  for (const tournament of eligibleTournaments) {
    const maxTeams = faker.number.int({ min: 8, max: 24 });
    let registrationCount: number;

    switch (tournament.status) {
      case TournamentStatus.PUBLISHED:
        registrationCount = faker.number.int({ min: Math.floor(maxTeams * 0.3), max: Math.floor(maxTeams * 0.7) });
        break;
      case TournamentStatus.ONGOING:
      case TournamentStatus.COMPLETED:
        registrationCount = faker.number.int({ min: Math.floor(maxTeams * 0.6), max: maxTeams });
        break;
      default:
        registrationCount = faker.number.int({ min: 2, max: 6 });
    }

    const shuffledClubs = shuffleArray([...clubs]);
    let addedCount = 0;
    let approvedCount = 0;
    const approvedCountByAgeGroup = new Map<string, number>();
    const tournamentAgeGroups = ageGroupsByTournament.get(tournament.id) || [];

    for (const club of shuffledClubs) {
      if (addedCount >= registrationCount) break;
      const comboKey = `${tournament.id}-${club.id}`;
      if (usedCombinations.has(comboKey)) continue;
      if (club.ownerId === tournament.organizerId) continue;
      usedCombinations.add(comboKey);

      let status: RegistrationStatus;
      let paymentStatus: PaymentStatus;

      if (tournament.status === TournamentStatus.ONGOING || tournament.status === TournamentStatus.COMPLETED) {
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

      const groupLetters = ['A', 'B', 'C', 'D'];
      const groupAssignment =
        status === RegistrationStatus.APPROVED &&
        (tournament.status === TournamentStatus.ONGOING || tournament.status === TournamentStatus.COMPLETED)
          ? faker.helpers.arrayElement(groupLetters)
          : undefined;

      // Link a team from that club, preferring one compatible with tournament age groups
      const clubTeams = teamsByClub.get(club.id) || [];

      const compatibleTeams = tournamentAgeGroups.length > 0
        ? clubTeams.filter((clubTeam) =>
            tournamentAgeGroups.some(
              (ageGroup) =>
                ageGroup.birthYear === clubTeam.birthyear ||
                (!!ageGroup.ageCategory && ageGroup.ageCategory === clubTeam.ageCategory),
            ),
          )
        : clubTeams;

      if (tournamentAgeGroups.length > 0 && compatibleTeams.length === 0) {
        continue;
      }

      const teamPool = compatibleTeams.length > 0 ? compatibleTeams : clubTeams;
      const team = teamPool.length > 0 ? faker.helpers.arrayElement(teamPool) : undefined;

      const compatibleAgeGroups = tournamentAgeGroups.filter(
        (ageGroup) =>
          ageGroup.birthYear === team?.birthyear ||
          (!!ageGroup.ageCategory && ageGroup.ageCategory === team?.ageCategory),
      );

      if (tournamentAgeGroups.length > 0 && compatibleAgeGroups.length === 0) {
        continue;
      }

      const ageGroup = compatibleAgeGroups.length > 0
        ? faker.helpers.arrayElement(compatibleAgeGroups)
        : undefined;

      const id = generateUUID();
      const registrationDate = seedDate();

      await registrationRepository.insert({
        id,
        tournament: { id: tournament.id },
        club: { id: club.id },
        ...(team ? { team: { id: team.id } } : {}),
        ...(ageGroup ? { ageGroup: { id: ageGroup.id } } : {}),
        status,
        groupAssignment,
        numberOfPlayers: faker.number.int({ min: 12, max: 22 }),
        coachName: faker.person.fullName(),
        coachPhone: generateRomanianPhone(),
        emergencyContact: generateRomanianPhone(),
        notes: faker.datatype.boolean({ probability: 0.3 }) ? faker.lorem.sentence() : undefined,
        paymentStatus,
        registrationDate,
        createdAt: registrationDate,
      });

      if (status === RegistrationStatus.APPROVED) {
        approvedCount++;
        if (ageGroup) {
          approvedCountByAgeGroup.set(
            ageGroup.id,
            (approvedCountByAgeGroup.get(ageGroup.id) || 0) + 1,
          );
        }
      }

      seededRegistrations.push({
        id,
        tournamentId: tournament.id,
        clubId: club.id,
        teamId: team?.id,
        status,
        paymentStatus,
      });
      addedCount++;
    }

    if (approvedCount > 0) {
      await tournamentRepository.update(tournament.id, { currentTeams: approvedCount });
    }

    for (const [ageGroupId, currentTeams] of approvedCountByAgeGroup) {
      await tournamentAgeGroupRepository.update(ageGroupId, { currentTeams });
    }
  }

  console.log(`✅ Seeded ${seededRegistrations.length} registrations`);
  return seededRegistrations;
}
