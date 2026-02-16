import { DataSource } from 'typeorm';
import {
  faker,
  generateUUID,
  toDateString,
  generateTournamentFee,
  seedDatePast,
} from '../utils/helpers';
import {
  AgeCategory,
  TournamentLevel,
  TournamentFormat,
} from '../../common/enums';

export interface SeededTournamentAgeGroup {
  id: string;
  tournamentId: string;
  birthYear: number;
  ageCategory: AgeCategory;
  gameSystem: string;
  teamCount: number;
}

const AGE_BIRTH_MAP: { cat: AgeCategory; year: number; system: string }[] = [
  { cat: AgeCategory.U8, year: 2018, system: '5+1' },
  { cat: AgeCategory.U9, year: 2017, system: '5+1' },
  { cat: AgeCategory.U10, year: 2016, system: '7+1' },
  { cat: AgeCategory.U11, year: 2015, system: '7+1' },
  { cat: AgeCategory.U12, year: 2014, system: '9+1' },
  { cat: AgeCategory.U13, year: 2013, system: '9+1' },
  { cat: AgeCategory.U14, year: 2012, system: '11+1' },
  { cat: AgeCategory.U15, year: 2011, system: '11+1' },
  { cat: AgeCategory.U16, year: 2010, system: '11+1' },
  { cat: AgeCategory.U17, year: 2009, system: '11+1' },
];

const FORMATS = Object.values(TournamentFormat);
const LEVELS = Object.values(TournamentLevel);

/**
 * Seed 2-4 age groups per tournament.
 */
export async function seedTournamentAgeGroups(
  dataSource: DataSource,
  tournaments: { id: string; startDate: Date; endDate: Date }[],
): Promise<SeededTournamentAgeGroup[]> {
  const repo = dataSource.getRepository('TournamentAgeGroup');
  const seeded: SeededTournamentAgeGroup[] = [];

  for (const t of tournaments) {
    const count = faker.number.int({ min: 2, max: 4 });
    const picks = faker.helpers.arrayElements(AGE_BIRTH_MAP, count);

    for (const pick of picks) {
      const id = generateUUID();
      const teamCount = faker.helpers.arrayElement([8, 12, 16, 20]) as number;

      // Registration opens 60-30 days before start
      const regStart = new Date(t.startDate);
      regStart.setDate(regStart.getDate() - faker.number.int({ min: 30, max: 60 }));
      const regEnd = new Date(t.startDate);
      regEnd.setDate(regEnd.getDate() - faker.number.int({ min: 5, max: 14 }));

      await repo.insert({
        id,
        tournament: { id: t.id },
        birthYear: pick.year,
        ageCategory: pick.cat,
        level: faker.helpers.arrayElement(LEVELS),
        format: faker.helpers.arrayElement(FORMATS),
        displayLabel: pick.cat,
        gameSystem: pick.system,
        teamCount,
        minTeams: 4,
        maxTeams: teamCount,
        numberOfMatches: faker.number.int({ min: 3, max: 6 }),
        currentTeams: 0,
        guaranteedMatches: faker.number.int({ min: 3, max: 5 }),
        startDate: toDateString(t.startDate),
        endDate: toDateString(t.endDate),
        registrationStartDate: toDateString(regStart),
        registrationEndDate: toDateString(regEnd),
        participationFee: generateTournamentFee(),
        teamsPerGroup: 4,
        drawCompleted: false,
        createdAt: seedDatePast(),
      });

      seeded.push({
        id,
        tournamentId: t.id,
        birthYear: pick.year,
        ageCategory: pick.cat,
        gameSystem: pick.system,
        teamCount,
      });
    }
  }

  console.log(`✅ Seeded ${seeded.length} tournament age groups`);
  return seeded;
}
