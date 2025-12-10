import { faker } from '@faker-js/faker';
import {
  TournamentStatus,
  AgeCategory,
  TournamentLevel,
} from '../../src/common/enums';

interface TournamentOverrides {
  name?: string;
  description?: string;
  ageCategory?: AgeCategory;
  level?: TournamentLevel;
  gameSystem?: string;
  numberOfMatches?: number;
  startDate?: string;
  endDate?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  maxTeams?: number;
  participationFee?: number;
  currency?: string;
  status?: TournamentStatus;
  isPublished?: boolean;
}

export const createTournamentFixture = (
  overrides: TournamentOverrides = {},
) => {
  const startDate = faker.date.future({ years: 1 });
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2);

  return {
    name: `${faker.company.name()} Cup ${faker.date.future().getFullYear()}`,
    description: faker.lorem.paragraph(),
    ageCategory: AgeCategory.U12,
    level: TournamentLevel.LEVEL_I,
    gameSystem: '4+1',
    numberOfMatches: 6,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    location: 'Brașov, Romania',
    latitude: 45.6427,
    longitude: 25.5887,
    maxTeams: 16,
    participationFee: 200,
    currency: 'EUR',
    status: TournamentStatus.DRAFT,
    ...overrides,
  };
};

export const createPublishedTournamentFixture = (
  overrides: TournamentOverrides = {},
) =>
  createTournamentFixture({
    status: TournamentStatus.PUBLISHED,
    isPublished: true,
    ...overrides,
  });
