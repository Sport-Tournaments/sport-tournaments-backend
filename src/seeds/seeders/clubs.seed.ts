import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import {
  generateUUID,
  generateRomanianPhone,
  getRandomPastDate,
} from '../utils/helpers';
import { ROMANIAN_CITIES, FOOTBALL_CLUB_SUFFIXES } from '../data/locations';

export interface SeededClub {
  id: string;
  name: string;
  ownerId: string;
  city: string;
}

/**
 * Seed clubs table with realistic data
 * - 3 clubs per organizer (20 organizers × 3 = 60 clubs)
 * - 1-2 clubs per participant (30 participants = ~45 clubs)
 * Total: ~105 clubs
 */
export async function seedClubs(
  dataSource: DataSource,
  organizerIds: string[],
  participantIds: string[],
): Promise<SeededClub[]> {
  const clubRepository = dataSource.getRepository('Club');
  const seededClubs: SeededClub[] = [];

  // Each organizer gets 3 clubs
  for (const organizerId of organizerIds) {
    for (let i = 0; i < 3; i++) {
      const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
      const suffix = faker.helpers.arrayElement(FOOTBALL_CLUB_SUFFIXES);
      const baseName = faker.location.city();
      const id = generateUUID();
      const name = `${baseName} ${suffix} ${faker.string.alpha({ length: 2, casing: 'upper' })}`;
      
      // Add some variance to coordinates (within ~10km)
      const latOffset = faker.number.float({ min: -0.05, max: 0.05 });
      const lngOffset = faker.number.float({ min: -0.05, max: 0.05 });

      await clubRepository.insert({
        id,
        name,
        organizer: { id: organizerId },
        country: city.country,
        city: city.name,
        latitude: city.lat + latOffset,
        longitude: city.lng + lngOffset,
        description: faker.lorem.paragraphs(2),
        logo: faker.image.url(),
        foundedYear: faker.number.int({ min: 1950, max: 2023 }),
        isVerified: faker.datatype.boolean({ probability: 0.7 }),
        isPremium: faker.datatype.boolean({ probability: 0.3 }),
        website: faker.datatype.boolean({ probability: 0.6 })
          ? `https://www.${baseName.toLowerCase().replace(/\s/g, '')}-fc.com`
          : undefined,
        contactEmail: faker.internet.email({ firstName: baseName.toLowerCase() }),
        contactPhone: generateRomanianPhone(),
        createdAt: getRandomPastDate(1.5),
      });

      seededClubs.push({
        id,
        name,
        ownerId: organizerId,
        city: city.name,
      });
    }
  }

  // Each participant gets 1-2 clubs
  for (const participantId of participantIds) {
    const clubCount = faker.number.int({ min: 1, max: 2 });
    
    for (let i = 0; i < clubCount; i++) {
      const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
      const suffix = faker.helpers.arrayElement(FOOTBALL_CLUB_SUFFIXES);
      const baseName = faker.location.city();
      const id = generateUUID();
      const name = `${baseName} ${suffix} ${faker.string.alpha({ length: 3, casing: 'upper' })}`;
      
      const latOffset = faker.number.float({ min: -0.05, max: 0.05 });
      const lngOffset = faker.number.float({ min: -0.05, max: 0.05 });

      await clubRepository.insert({
        id,
        name,
        organizer: { id: participantId },
        country: city.country,
        city: city.name,
        latitude: city.lat + latOffset,
        longitude: city.lng + lngOffset,
        description: faker.lorem.paragraph(),
        logo: faker.datatype.boolean({ probability: 0.5 }) ? faker.image.url() : undefined,
        foundedYear: faker.number.int({ min: 1980, max: 2023 }),
        isVerified: faker.datatype.boolean({ probability: 0.4 }),
        isPremium: faker.datatype.boolean({ probability: 0.1 }),
        website: faker.datatype.boolean({ probability: 0.3 })
          ? `https://www.${baseName.toLowerCase().replace(/\s/g, '')}.com`
          : undefined,
        contactEmail: faker.internet.email({ firstName: baseName.toLowerCase() }),
        contactPhone: generateRomanianPhone(),
        createdAt: getRandomPastDate(1),
      });

      seededClubs.push({
        id,
        name,
        ownerId: participantId,
        city: city.name,
      });
    }
  }

  console.log(`✅ Seeded ${seededClubs.length} clubs`);
  return seededClubs;
}
