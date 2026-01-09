import { faker } from '@faker-js/faker';

export const createClubFixture = (overrides: Partial<any> = {}) => ({
  name: `${faker.company.name()} FC`,
  city: faker.location.city(),
  country: 'Romania',
  foundedYear: faker.number.int({ min: 1900, max: 2020 }),
  logoUrl: faker.image.url(),
  website: faker.internet.url(),
  contactEmail: faker.internet.email(),
  contactPhone: faker.phone.number({ style: 'international' }),
  ...overrides,
});

export const createRegistrationFixture = (
  tournamentId: string,
  clubId: string,
  overrides: Partial<any> = {},
) => ({
  tournamentId,
  clubId,
  numberOfPlayers: faker.number.int({ min: 11, max: 20 }),
  coachName: faker.person.fullName(),
  coachPhone: faker.phone.number({ style: 'international' }),
  ...overrides,
});
