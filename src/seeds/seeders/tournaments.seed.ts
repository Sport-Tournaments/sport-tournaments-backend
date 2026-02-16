import { DataSource } from 'typeorm';
import {
  TournamentStatus,
  TournamentLevel,
  Currency,
  AgeCategory,
} from '../../common/enums';
import {
  faker,
  generateUUID,
  generateRomanianPhone,
  seedDatePast,
  getTournamentDateRange,
  generateTournamentFee,
  pickRandom,
  pickRandomMultiple,
  toDateString,
} from '../utils/helpers';
import {
  ROMANIAN_CITIES,
  TOURNAMENT_NAME_PREFIXES,
  TOURNAMENT_NAME_SUFFIXES,
  GAME_SYSTEMS,
  TOURNAMENT_TAGS,
} from '../data/locations';

export interface SeededTournament {
  id: string;
  name: string;
  organizerId: string;
  status: string;
  drawCompleted: boolean;
  fee: number;
  startDate: Date;
  endDate: Date;
}

const AGE_CATEGORIES = Object.values(AgeCategory);
const TOURNAMENT_LEVELS = Object.values(TournamentLevel);
const STATUSES = Object.values(TournamentStatus).filter(
  (s) => s !== TournamentStatus.CANCELLED,
);

function generateTournamentName(ageCategory: AgeCategory): string {
  const prefix = pickRandom(TOURNAMENT_NAME_PREFIXES);
  const suffix = pickRandom(TOURNAMENT_NAME_SUFFIXES);
  const city = faker.helpers.arrayElement(ROMANIAN_CITIES).name;
  const patterns = [
    `${city} ${prefix} ${suffix} ${ageCategory} 2026`,
    `Cupa ${city} ${ageCategory} 2026`,
    `${prefix} ${ageCategory} ${suffix} 2026`,
    `Turneul ${city} ${ageCategory} 2026`,
  ];
  return pickRandom(patterns);
}

/**
 * Seed tournaments – all in Romania, dates Oct 2025 → Oct 2026.
 * - 4 per organizer (15 × 4 = 60) with varied statuses
 * - 15 extra random
 * Total = 75 tournaments
 */
export async function seedTournaments(
  dataSource: DataSource,
  organizerIds: string[],
): Promise<SeededTournament[]> {
  const tournamentRepository = dataSource.getRepository('Tournament');
  const seededTournaments: SeededTournament[] = [];

  for (const organizerId of organizerIds) {
    const statusCycle = [
      TournamentStatus.DRAFT,
      TournamentStatus.PUBLISHED,
      TournamentStatus.ONGOING,
      TournamentStatus.COMPLETED,
    ];

    for (let i = 0; i < 4; i++) {
      const status = statusCycle[i];
      const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
      const ageCategory = pickRandom(AGE_CATEGORIES);
      const level = pickRandom(TOURNAMENT_LEVELS);
      const gameSystem = pickRandom(GAME_SYSTEMS);
      const maxTeams = faker.helpers.arrayElement([8, 12, 16, 20, 24, 32]);
      const id = generateUUID();
      const name = generateTournamentName(ageCategory);
      const fee = generateTournamentFee();

      let dateRange: { startDate: Date; endDate: Date };
      switch (status) {
        case TournamentStatus.COMPLETED:
          dateRange = getTournamentDateRange('past');
          break;
        case TournamentStatus.ONGOING:
          dateRange = getTournamentDateRange('ongoing');
          break;
        default:
          dateRange = getTournamentDateRange('upcoming');
      }

      const regDeadline = new Date(dateRange.startDate);
      regDeadline.setDate(regDeadline.getDate() - faker.number.int({ min: 7, max: 30 }));

      let currentTeams = 0;
      if (status === TournamentStatus.PUBLISHED) {
        currentTeams = faker.number.int({ min: 2, max: Math.floor(maxTeams * 0.7) });
      } else if (status === TournamentStatus.ONGOING || status === TournamentStatus.COMPLETED) {
        currentTeams = faker.number.int({ min: Math.floor(maxTeams * 0.6), max: maxTeams });
      }

      const latOffset = faker.number.float({ min: -0.05, max: 0.05 });
      const lngOffset = faker.number.float({ min: -0.05, max: 0.05 });
      const drawCompleted = status === TournamentStatus.ONGOING || status === TournamentStatus.COMPLETED;

      await tournamentRepository.insert({
        id,
        name,
        organizer: { id: organizerId },
        description: faker.lorem.paragraphs(3),
        status,
        startDate: toDateString(dateRange.startDate),
        endDate: toDateString(dateRange.endDate),
        location: `${faker.location.streetAddress()}, ${city.name}, Romania`,
        latitude: city.lat + latOffset,
        longitude: city.lng + lngOffset,
        ageCategory,
        level,
        gameSystem,
        numberOfMatches: faker.number.int({ min: maxTeams, max: maxTeams * 3 }),
        maxTeams,
        currentTeams,
        currency: Currency.RON,
        participationFee: fee,
        isPremium: faker.datatype.boolean({ probability: 0.2 }),
        isPublished: status !== TournamentStatus.DRAFT,
        isFeatured: faker.datatype.boolean({ probability: 0.1 }),
        tags: pickRandomMultiple(TOURNAMENT_TAGS, { min: 1, max: 4 }),
        registrationDeadline: status === TournamentStatus.DRAFT ? undefined : toDateString(regDeadline),
        contactEmail: faker.internet.email(),
        contactPhone: generateRomanianPhone(),
        drawSeed: drawCompleted ? faker.string.alphanumeric(16) : undefined,
        drawCompleted,
        isPrivate: faker.datatype.boolean({ probability: 0.15 }),
        country: 'Romania',
        createdAt: seedDatePast(),
      });

      seededTournaments.push({
        id, name, organizerId, status, drawCompleted, fee,
        startDate: dateRange.startDate, endDate: dateRange.endDate,
      });
    }
  }

  // 15 extra tournaments
  for (let i = 0; i < 15; i++) {
    const organizerId = faker.helpers.arrayElement(organizerIds);
    const status = pickRandom(STATUSES);
    const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
    const ageCategory = pickRandom(AGE_CATEGORIES);
    const maxTeams = faker.helpers.arrayElement([8, 12, 16, 20, 24]);
    const id = generateUUID();
    const name = generateTournamentName(ageCategory);
    const fee = generateTournamentFee();

    let dateRange: { startDate: Date; endDate: Date };
    if (status === TournamentStatus.COMPLETED) dateRange = getTournamentDateRange('past');
    else if (status === TournamentStatus.ONGOING) dateRange = getTournamentDateRange('ongoing');
    else dateRange = getTournamentDateRange('upcoming');

    const drawCompleted = status === TournamentStatus.ONGOING || status === TournamentStatus.COMPLETED;
    const latOffset = faker.number.float({ min: -0.05, max: 0.05 });
    const lngOffset = faker.number.float({ min: -0.05, max: 0.05 });

    await tournamentRepository.insert({
      id,
      name,
      organizer: { id: organizerId },
      description: faker.lorem.paragraphs(2),
      status,
      startDate: toDateString(dateRange.startDate),
      endDate: toDateString(dateRange.endDate),
      location: `${city.name}, Romania`,
      latitude: city.lat + latOffset,
      longitude: city.lng + lngOffset,
      ageCategory,
      level: pickRandom(TOURNAMENT_LEVELS),
      gameSystem: pickRandom(GAME_SYSTEMS),
      numberOfMatches: faker.number.int({ min: maxTeams, max: maxTeams * 2 }),
      maxTeams,
      currentTeams: status === TournamentStatus.DRAFT ? 0 : faker.number.int({ min: 2, max: maxTeams }),
      currency: Currency.RON,
      participationFee: fee,
      isPremium: faker.datatype.boolean({ probability: 0.15 }),
      isPublished: status !== TournamentStatus.DRAFT,
      isFeatured: faker.datatype.boolean({ probability: 0.05 }),
      tags: pickRandomMultiple(TOURNAMENT_TAGS, { min: 1, max: 3 }),
      contactEmail: faker.internet.email(),
      contactPhone: generateRomanianPhone(),
      drawCompleted,
      isPrivate: faker.datatype.boolean({ probability: 0.1 }),
      country: 'Romania',
      createdAt: seedDatePast(),
    });

    seededTournaments.push({
      id, name, organizerId, status, drawCompleted, fee,
      startDate: dateRange.startDate, endDate: dateRange.endDate,
    });
  }

  console.log(`✅ Seeded ${seededTournaments.length} tournaments`);
  return seededTournaments;
}
