import { DataSource } from 'typeorm';
import { UserRole } from '../../common/enums';
import {
  faker,
  generateUUID,
  hashPassword,
  generateTeamColors,
  generateRomanianPhone,
  seedDatePast,
} from '../utils/helpers';
import { ROMANIAN_CITIES } from '../data/locations';

export interface SeededUser {
  id: string;
  email: string;
  password: string; // plain-text for credential reference
  role: UserRole;
  firstName: string;
  lastName: string;
}

/**
 * Seed users table with realistic Romanian data.
 * - 5 Admins
 * - 15 Organizers (tournament creators)
 * - 30 Participants (club representatives)
 * All dates fall inside Oct 2025 – Oct 2026.
 * Credentials are returned so they can be saved to a reference file.
 */
export async function seedUsers(dataSource: DataSource): Promise<SeededUser[]> {
  const userRepository = dataSource.getRepository('User');
  const seededUsers: SeededUser[] = [];

  const ADMIN_PASSWORD = 'Admin123!';
  const USER_PASSWORD = 'Password123!';
  const hashedAdminPwd = await hashPassword(ADMIN_PASSWORD);
  const hashedUserPwd = await hashPassword(USER_PASSWORD);

  // ── Admins (5) ──
  for (let i = 0; i < 5; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const id = generateUUID();
    const email = `admin${i + 1}@turnee-sportive.ro`;

    await userRepository.insert({
      id,
      email,
      password: hashedAdminPwd,
      firstName,
      lastName,
      phone: generateRomanianPhone(),
      country: 'Romania',
      role: UserRole.ADMIN,
      isActive: true,
      isVerified: true,
      profileImageUrl: faker.image.avatar(),
      organizationName: 'Platforma Turnee Sportive',
      createdAt: seedDatePast(),
    });

    seededUsers.push({ id, email, password: ADMIN_PASSWORD, role: UserRole.ADMIN, firstName, lastName });
  }

  // ── Organizers (15) ──
  for (let i = 0; i < 15; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
    const id = generateUUID();
    const email = `organizator${i + 1}@turnee-sportive.ro`;

    await userRepository.insert({
      id,
      email,
      password: hashedUserPwd,
      firstName,
      lastName,
      phone: generateRomanianPhone(),
      country: 'Romania',
      role: UserRole.ORGANIZER,
      isActive: true,
      isVerified: true,
      profileImageUrl: faker.image.avatar(),
      teamColors: generateTeamColors(),
      organizationName: `${faker.company.name()} Sport`,
      organizationLogo: faker.image.url(),
      defaultLocation: {
        latitude: city.lat,
        longitude: city.lng,
        address: `${faker.location.streetAddress()}, ${city.name}`,
        venueName: `Stadionul ${faker.company.name()}`,
      },
      createdAt: seedDatePast(),
    });

    seededUsers.push({ id, email, password: USER_PASSWORD, role: UserRole.ORGANIZER, firstName, lastName });
  }

  // ── Participants (30) ──
  for (let i = 0; i < 30; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const isVerified = faker.datatype.boolean({ probability: 0.9 });
    const id = generateUUID();
    const email = `participant${i + 1}@turnee-sportive.ro`;

    await userRepository.insert({
      id,
      email,
      password: hashedUserPwd,
      firstName,
      lastName,
      phone: generateRomanianPhone(),
      country: 'Romania',
      role: UserRole.PARTICIPANT,
      isActive: true,
      isVerified,
      emailVerificationToken: isVerified ? undefined : faker.string.alphanumeric(64),
      profileImageUrl: faker.image.avatar(),
      createdAt: seedDatePast(),
    });

    seededUsers.push({ id, email, password: USER_PASSWORD, role: UserRole.PARTICIPANT, firstName, lastName });
  }

  console.log(`✅ Seeded ${seededUsers.length} users (5 admins, 15 organizers, 30 participants)`);
  return seededUsers;
}
