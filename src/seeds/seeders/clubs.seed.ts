import { DataSource } from 'typeorm';
import {
  faker,
  generateUUID,
  generateRomanianPhone,
  seedDatePast,
} from '../utils/helpers';
import { ROMANIAN_CITIES, FOOTBALL_CLUB_SUFFIXES } from '../data/locations';

export interface SeededClub {
  id: string;
  name: string;
  ownerId: string;
  city: string;
}

/**
 * Seed clubs – all located in Romania.
 * - 3 clubs per organizer (15 × 3 = 45)
 * - 1–2 clubs per participant (30 × ~1.5 = ~45)
 * Total ≈ 90 clubs
 */
export async function seedClubs(
  dataSource: DataSource,
  organizerIds: string[],
  participantIds: string[],
): Promise<SeededClub[]> {
  const clubRepository = dataSource.getRepository('Club');
  const seededClubs: SeededClub[] = [];

  const RO_CLUB_WORDS = [
    'Viitorul', 'Rapid', 'Gloria', 'Progresul', 'Olimpia',
    'Steaua', 'Universitatea', 'Petrolul', 'Astra', 'Poli',
    'Dinamo', 'Metalul', 'Minerul', 'Energia', 'Victoria',
    'Flamura', 'Sportul', 'Voința', 'Unirea', 'CSM',
  ];

  function roClubName(city: string): string {
    const word = faker.helpers.arrayElement(RO_CLUB_WORDS);
    const suffix = faker.helpers.arrayElement(FOOTBALL_CLUB_SUFFIXES);
    return `${word} ${city} ${suffix}`;
  }

  async function insertClub(ownerId: string): Promise<SeededClub> {
    const city = faker.helpers.arrayElement(ROMANIAN_CITIES);
    const id = generateUUID();
    const name = roClubName(city.name) + ` ${faker.string.alpha({ length: 2, casing: 'upper' })}`;
    const latOffset = faker.number.float({ min: -0.05, max: 0.05 });
    const lngOffset = faker.number.float({ min: -0.05, max: 0.05 });

    await clubRepository.insert({
      id,
      name,
      organizer: { id: ownerId },
      country: 'Romania',
      city: city.name,
      latitude: city.lat + latOffset,
      longitude: city.lng + lngOffset,
      description: faker.lorem.paragraphs(2),
      logo: faker.image.url(),
      primaryColor: faker.color.rgb({ format: 'hex' }),
      secondaryColor: faker.color.rgb({ format: 'hex' }),
      foundedYear: faker.number.int({ min: 1920, max: 2024 }),
      isVerified: faker.datatype.boolean({ probability: 0.7 }),
      isPremium: faker.datatype.boolean({ probability: 0.2 }),
      website: faker.datatype.boolean({ probability: 0.5 })
        ? `https://www.${name.toLowerCase().replace(/\s/g, '-')}.ro`
        : undefined,
      contactEmail: faker.internet.email({ firstName: city.name.toLowerCase() }),
      contactPhone: generateRomanianPhone(),
      createdAt: seedDatePast(),
    });

    return { id, name, ownerId, city: city.name };
  }

  // 3 clubs per organizer
  for (const organizerId of organizerIds) {
    for (let i = 0; i < 3; i++) {
      seededClubs.push(await insertClub(organizerId));
    }
  }

  // 1-2 clubs per participant
  for (const participantId of participantIds) {
    const count = faker.number.int({ min: 1, max: 2 });
    for (let i = 0; i < count; i++) {
      seededClubs.push(await insertClub(participantId));
    }
  }

  console.log(`✅ Seeded ${seededClubs.length} clubs`);
  return seededClubs;
}
