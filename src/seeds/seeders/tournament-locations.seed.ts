import { DataSource } from 'typeorm';
import {
  faker,
  generateUUID,
  generateRomanianPhone,
  seedDatePast,
} from '../utils/helpers';
import { ROMANIAN_CITIES } from '../data/locations';

export interface SeededTournamentLocation {
  id: string;
  tournamentId: string;
  venueName: string;
}

const FIELD_TYPES = ['gazon natural', 'gazon sintetic', 'hybrid', 'sala'];
const FIELD_DIMS = ['40x20m', '50x30m', '68x45m', '90x60m', '100x64m', '105x68m'];

/**
 * Seed 1-3 locations per tournament.
 */
export async function seedTournamentLocations(
  dataSource: DataSource,
  tournamentIds: string[],
): Promise<SeededTournamentLocation[]> {
  const repo = dataSource.getRepository('TournamentLocation');
  const seeded: SeededTournamentLocation[] = [];

  for (const tournamentId of tournamentIds) {
    const count = faker.number.int({ min: 1, max: 3 });
    const city = faker.helpers.arrayElement(ROMANIAN_CITIES);

    for (let i = 0; i < count; i++) {
      const id = generateUUID();
      const venueName = `Baza Sportivă ${faker.company.name()} - Teren ${i + 1}`;
      const latOffset = faker.number.float({ min: -0.02, max: 0.02 });
      const lngOffset = faker.number.float({ min: -0.02, max: 0.02 });

      await repo.insert({
        id,
        tournament: { id: tournamentId },
        venueName,
        latitude: city.lat + latOffset,
        longitude: city.lng + lngOffset,
        address: `${faker.location.streetAddress()}, ${city.name}`,
        city: city.name,
        country: 'Romania',
        fieldCount: faker.number.int({ min: 1, max: 4 }),
        capacity: faker.number.int({ min: 100, max: 5000 }),
        fieldType: faker.helpers.arrayElement(FIELD_TYPES),
        fieldDimensions: faker.helpers.arrayElement(FIELD_DIMS),
        facilities: {
          changingRooms: true,
          showers: faker.datatype.boolean(),
          parking: faker.datatype.boolean({ probability: 0.8 }),
          spectatorSeating: faker.datatype.boolean({ probability: 0.7 }),
          floodlights: faker.datatype.boolean({ probability: 0.5 }),
          firstAid: true,
          refreshments: faker.datatype.boolean({ probability: 0.6 }),
        },
        contactName: faker.person.fullName(),
        contactPhone: generateRomanianPhone(),
        contactEmail: faker.internet.email(),
        displayOrder: i,
        isPrimary: i === 0,
        createdAt: seedDatePast(),
      });

      seeded.push({ id, tournamentId, venueName });
    }
  }

  console.log(`✅ Seeded ${seeded.length} tournament locations`);
  return seeded;
}
