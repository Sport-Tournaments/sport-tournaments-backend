import { DataSource } from 'typeorm';
import {
  faker,
  generateUUID,
  seedDatePast,
} from '../utils/helpers';
import { AgeCategory } from '../../common/enums';

export interface SeededTeam {
  id: string;
  clubId: string;
  name: string;
  ageCategory: string;
  birthyear: number;
}

const AGE_MAP: { category: AgeCategory; birthyear: number }[] = [
  { category: AgeCategory.U8, birthyear: 2018 },
  { category: AgeCategory.U9, birthyear: 2017 },
  { category: AgeCategory.U10, birthyear: 2016 },
  { category: AgeCategory.U11, birthyear: 2015 },
  { category: AgeCategory.U12, birthyear: 2014 },
  { category: AgeCategory.U13, birthyear: 2013 },
  { category: AgeCategory.U14, birthyear: 2012 },
  { category: AgeCategory.U15, birthyear: 2011 },
  { category: AgeCategory.U16, birthyear: 2010 },
  { category: AgeCategory.U17, birthyear: 2009 },
  { category: AgeCategory.U18, birthyear: 2008 },
  { category: AgeCategory.U19, birthyear: 2007 },
];

/**
 * Seed teams – 2-4 teams per club, each with an age category.
 * Total ≈ 90 clubs × 3 = ~270 teams
 */
export async function seedTeams(
  dataSource: DataSource,
  clubs: { id: string; name: string }[],
): Promise<SeededTeam[]> {
  const teamRepository = dataSource.getRepository('Team');
  const seededTeams: SeededTeam[] = [];

  for (const club of clubs) {
    const teamCount = faker.number.int({ min: 2, max: 4 });
    // Pick distinct age categories for this club
    const ageGroups = faker.helpers.arrayElements(AGE_MAP, teamCount);

    for (const ag of ageGroups) {
      const id = generateUUID();
      const name = `${club.name.split(' ').slice(0, 2).join(' ')} ${ag.category}`;

      await teamRepository.insert({
        id,
        club: { id: club.id },
        name,
        ageCategory: ag.category,
        birthyear: ag.birthyear,
        coach: `${faker.person.firstName()} ${faker.person.lastName()}`,
        createdAt: seedDatePast(),
      });

      seededTeams.push({
        id,
        clubId: club.id,
        name,
        ageCategory: ag.category,
        birthyear: ag.birthyear,
      });
    }
  }

  console.log(`✅ Seeded ${seededTeams.length} teams`);
  return seededTeams;
}
