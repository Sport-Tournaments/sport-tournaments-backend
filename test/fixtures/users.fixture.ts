import { faker } from '@faker-js/faker';
import { UserRole } from '../../src/common/enums';

export const createUserFixture = (overrides: Partial<any> = {}) => ({
  email: faker.internet.email(),
  password: 'TestPass123!',
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  phone: faker.phone.number({ style: 'international' }),
  country: 'Romania',
  role: UserRole.PARTICIPANT,
  ...overrides,
});

export const createOrganizerFixture = (overrides: Partial<any> = {}) =>
  createUserFixture({
    role: UserRole.ORGANIZER,
    ...overrides,
  });

export const createAdminFixture = (overrides: Partial<any> = {}) =>
  createUserFixture({
    role: UserRole.ADMIN,
    ...overrides,
  });

export const loginCredentials = (email: string) => ({
  email,
  password: 'TestPass123!',
});
