import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
  TournamentStatus,
  TournamentLevel,
  Currency,
  AgeCategory,
} from '../../common/enums';
import {
  generateUUID,
  generateRomanianPhone,
  getRandomPastDate,
  getTournamentDateRange,
  generateTournamentFee,
  pickRandom,
  pickRandomMultiple,
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
}

const AGE_CATEGORIES = Object.values(AgeCategory);
const TOURNAMENT_LEVELS = Object.values(TournamentLevel);
const STATUSES = Object.values(TournamentStatus).filter(
  (s) => s !== TournamentStatus.CANCELLED,
);

/**
 * Generate a realistic tournament name
 */
function generateTournamentName(ageCategory: AgeCategory): string {
  const prefix = pickRandom(TOURNAMENT_NAME_PREFIXES);
  const suffix = pickRandom(TOURNAMENT_NAME_SUFFIXES);
  const year = faker.number.int({ min: 2024, max: 2026 });
  const city = faker.helpers.arrayElement(ROMANIAN_CITIES).name;

  const patterns = [
    `${city} ${prefix} ${suffix} ${ageCategory} ${year}`,
    `${prefix} ${ageCategory} ${suffix} ${year}`,
    `${city} ${ageCategory} ${suffix} ${year}`,
    `${prefix} ${city} ${suffix} ${year}`,
    `${ageCategory} ${prefix} ${suffix} ${year}`,
  ];

  return pickRandom(patterns);
}

/**
 * Seed tournaments table with realistic data
 * - 4 tournaments per organizer (20 organizers × 4 = 80 tournaments)
 * - 20 extra tournaments with random status
 * Total: 100 tournaments
 */
export async function seedTournaments(
  dataSource: DataSource,
  organizerIds: string[],
): Promise<SeededTournament[]> {
  const tournamentRepository = dataSource.getRepository('Tournament');
  const seededTournaments: SeededTournament[] = [];

  for (const organizerId of organizerIds) {
    // Each organizer gets 4 tournaments with different statuses
    const organizerStatuses = [
      TournamentStatus.DRAFT,
      TournamentStatus.PUBLISHED,
      TournamentStatus.ONGOING,
      TournamentStatus.COMPLETED,
    ];

    for (let i = 0; i < 4; i++) {
      const status = organizerStatuses[i];
      const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
      const ageCategory = pickRandom(AGE_CATEGORIES);
      const level = pickRandom(TOURNAMENT_LEVELS);
      const gameSystem = pickRandom(GAME_SYSTEMS);
      const maxTeams = faker.helpers.arrayElement([8, 12, 16, 20, 24, 32]);
      const id = generateUUID();
      const name = generateTournamentName(ageCategory);
      const fee = generateTournamentFee();

      // Date ranges based on status
      let startDate: Date;
      let endDate: Date;

      switch (status) {
        case TournamentStatus.DRAFT:
          ({ startDate, endDate } = getTournamentDateRange(true));
          break;
        case TournamentStatus.PUBLISHED:
          startDate = faker.date.soon({ days: 90 });
          endDate = new Date(startDate);
          endDate.setDate(
            endDate.getDate() + faker.number.int({ min: 1, max: 3 }),
          );
          break;
        case TournamentStatus.ONGOING:
          startDate = faker.date.recent({ days: 2 });
          endDate = faker.date.soon({ days: 2 });
          break;
        case TournamentStatus.COMPLETED:
          ({ startDate, endDate } = getTournamentDateRange(false));
          break;
        default:
          ({ startDate, endDate } = getTournamentDateRange(true));
      }

      const registrationDeadline = new Date(startDate);
      registrationDeadline.setDate(
        registrationDeadline.getDate() - faker.number.int({ min: 7, max: 30 }),
      );

      let currentTeams = 0;
      if (status === TournamentStatus.PUBLISHED) {
        currentTeams = faker.number.int({
          min: 2,
          max: Math.floor(maxTeams * 0.7),
        });
      } else if (
        status === TournamentStatus.ONGOING ||
        status === TournamentStatus.COMPLETED
      ) {
        currentTeams = faker.number.int({
          min: Math.floor(maxTeams * 0.6),
          max: maxTeams,
        });
      }

      const latOffset = faker.number.float({ min: -0.05, max: 0.05 });
      const lngOffset = faker.number.float({ min: -0.05, max: 0.05 });
      const drawCompleted =
        status === TournamentStatus.ONGOING ||
        status === TournamentStatus.COMPLETED;

      await tournamentRepository.insert({
        id,
        name,
        organizer: { id: organizerId },
        description: faker.lorem.paragraphs(3),
        status,
        startDate,
        endDate,
        location: `${faker.location.streetAddress()}, ${city.name}, ${city.country}`,
        latitude: city.lat + latOffset,
        longitude: city.lng + lngOffset,
        ageCategory,
        level,
        gameSystem,
        numberOfMatches: faker.number.int({ min: maxTeams, max: maxTeams * 3 }),
        maxTeams,
        currentTeams,
        regulationsDocument: faker.datatype.boolean({ probability: 0.6 })
          ? faker.internet.url()
          : undefined,
        regulationsDownloadCount: faker.number.int({ min: 0, max: 500 }),
        currency: faker.helpers.arrayElement([Currency.EUR, Currency.RON]),
        participationFee: fee,
        isPremium: faker.datatype.boolean({ probability: 0.2 }),
        isPublished: status !== TournamentStatus.DRAFT,
        isFeatured: faker.datatype.boolean({ probability: 0.1 }),
        tags: pickRandomMultiple(TOURNAMENT_TAGS, { min: 1, max: 4 }),
        registrationDeadline:
          status === TournamentStatus.DRAFT ? undefined : registrationDeadline,
        contactEmail: faker.internet.email(),
        contactPhone: generateRomanianPhone(),
        drawSeed: drawCompleted ? faker.string.alphanumeric(16) : undefined,
        drawCompleted,
        isPrivate: faker.datatype.boolean({ probability: 0.15 }),
        createdAt: getRandomPastDate(1),
      });

      seededTournaments.push({
        id,
        name,
        organizerId,
        status,
        drawCompleted,
        fee,
      });
    }
  }

  // Add 20 extra tournaments with random statuses
  for (let i = 0; i < 20; i++) {
    const organizerId = faker.helpers.arrayElement(organizerIds);
    const status = pickRandom(STATUSES);
    const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
    const ageCategory = pickRandom(AGE_CATEGORIES);
    const level = pickRandom(TOURNAMENT_LEVELS);
    const maxTeams = faker.helpers.arrayElement([8, 12, 16, 20, 24, 32]);
    const id = generateUUID();
    const name = generateTournamentName(ageCategory);
    const fee = generateTournamentFee();

    let startDate: Date;
    let endDate: Date;

    if (status === TournamentStatus.COMPLETED) {
      ({ startDate, endDate } = getTournamentDateRange(false));
    } else if (status === TournamentStatus.ONGOING) {
      startDate = faker.date.recent({ days: 1 });
      endDate = faker.date.soon({ days: 2 });
    } else {
      ({ startDate, endDate } = getTournamentDateRange(true));
    }

    const currentTeams =
      status === TournamentStatus.DRAFT
        ? 0
        : faker.number.int({ min: 2, max: maxTeams });

    const latOffset = faker.number.float({ min: -0.05, max: 0.05 });
    const lngOffset = faker.number.float({ min: -0.05, max: 0.05 });
    const drawCompleted =
      status === TournamentStatus.ONGOING ||
      status === TournamentStatus.COMPLETED;

    await tournamentRepository.insert({
      id,
      name,
      organizer: { id: organizerId },
      description: faker.lorem.paragraphs(2),
      status,
      startDate,
      endDate,
      location: `${city.name}, ${city.country}`,
      latitude: city.lat + latOffset,
      longitude: city.lng + lngOffset,
      ageCategory,
      level,
      gameSystem: pickRandom(GAME_SYSTEMS),
      numberOfMatches: faker.number.int({ min: maxTeams, max: maxTeams * 2 }),
      maxTeams,
      currentTeams,
      currency: Currency.EUR,
      participationFee: fee,
      isPremium: faker.datatype.boolean({ probability: 0.15 }),
      isPublished: status !== TournamentStatus.DRAFT,
      isFeatured: faker.datatype.boolean({ probability: 0.05 }),
      tags: pickRandomMultiple(TOURNAMENT_TAGS, { min: 1, max: 3 }),
      contactEmail: faker.internet.email(),
      contactPhone: generateRomanianPhone(),
      drawCompleted,
      isPrivate: faker.datatype.boolean({ probability: 0.1 }),
      createdAt: getRandomPastDate(0.5),
    });

    seededTournaments.push({
      id,
      name,
      organizerId,
      status,
      drawCompleted,
      fee,
    });
  }

  console.log(`✅ Seeded ${seededTournaments.length} tournaments`);
  return seededTournaments;
}
