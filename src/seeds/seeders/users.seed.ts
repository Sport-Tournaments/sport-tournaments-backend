import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { UserRole } from '../../common/enums';
import {
  generateUUID,
  hashPassword,
  generateTeamColors,
  generateRomanianPhone,
  getRandomPastDate,
} from '../utils/helpers';
import { COUNTRIES, ROMANIAN_CITIES } from '../data/locations';

export interface SeededUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

/**
 * Seed users table with realistic data
 * - 10 Admins
 * - 20 Organizers (tournament creators)
 * - 30 Participants (club representatives)
 */
export async function seedUsers(dataSource: DataSource): Promise<SeededUser[]> {
  const userRepository = dataSource.getRepository('User');
  const seededUsers: SeededUser[] = [];
  
  const hashedPassword = await hashPassword('Password123!');
  const hashedAdminPassword = await hashPassword('Admin123!');

  // Create Admins (10)
  for (let i = 0; i < 10; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const id = generateUUID();
    
    await userRepository.insert({
      id,
      email: `admin${i + 1}@footballtournament.com`,
      password: hashedAdminPassword,
      firstName,
      lastName,
      phone: generateRomanianPhone(),
      country: 'Romania',
      role: UserRole.ADMIN,
      isActive: true,
      isVerified: true,
      profileImageUrl: faker.image.avatar(),
      organizationName: 'Football Tournament Platform',
      createdAt: getRandomPastDate(2),
    });
    
    seededUsers.push({
      id,
      email: `admin${i + 1}@footballtournament.com`,
      role: UserRole.ADMIN,
      firstName,
      lastName,
    });
  }

  // Create Organizers (20)
  for (let i = 0; i < 20; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const country = faker.helpers.arrayElement(COUNTRIES);
    const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
    const id = generateUUID();
    
    await userRepository.insert({
      id,
      email: `organizer${i + 1}@example.com`,
      password: hashedPassword,
      firstName,
      lastName,
      phone: generateRomanianPhone(),
      country,
      role: UserRole.ORGANIZER,
      isActive: true,
      isVerified: true,
      profileImageUrl: faker.image.avatar(),
      teamColors: generateTeamColors(),
      organizationName: faker.company.name() + ' Sports',
      organizationLogo: faker.image.url(),
      defaultLocation: {
        latitude: city.lat,
        longitude: city.lng,
        address: `${faker.location.streetAddress()}, ${city.name}`,
        venueName: `${faker.company.name()} Stadium`,
      },
      createdAt: getRandomPastDate(2),
    });
    
    seededUsers.push({
      id,
      email: `organizer${i + 1}@example.com`,
      role: UserRole.ORGANIZER,
      firstName,
      lastName,
    });
  }

  // Create Participants (30)
  for (let i = 0; i < 30; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const isVerified = faker.datatype.boolean({ probability: 0.9 });
    const id = generateUUID();
    
    await userRepository.insert({
      id,
      email: `participant${i + 1}@example.com`,
      password: hashedPassword,
      firstName,
      lastName,
      phone: generateRomanianPhone(),
      country: faker.helpers.arrayElement(COUNTRIES),
      role: UserRole.PARTICIPANT,
      isActive: true,
      isVerified,
      emailVerificationToken: isVerified ? undefined : faker.string.alphanumeric(64),
      profileImageUrl: faker.image.avatar(),
      createdAt: getRandomPastDate(1.5),
    });
    
    seededUsers.push({
      id,
      email: `participant${i + 1}@example.com`,
      role: UserRole.PARTICIPANT,
      firstName,
      lastName,
    });
  }

  console.log(`✅ Seeded ${seededUsers.length} users (10 admins, 20 organizers, 30 participants)`);
  return seededUsers;
}
