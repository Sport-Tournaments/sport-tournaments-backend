import { DataSource } from 'typeorm';
import {
  faker,
  generateUUID,
  seedDatePast,
  toDateString,
} from '../utils/helpers';

export interface SeededPlayer {
  id: string;
  firstname: string;
  lastname: string;
  teamIds: string[];
}

/**
 * Seed players – 12-18 players per team, linked via team_players join table.
 * All player names are generated with the RO locale.
 */
export async function seedPlayers(
  dataSource: DataSource,
  teams: { id: string; birthyear: number }[],
): Promise<SeededPlayer[]> {
  const playerRepository = dataSource.getRepository('Player');
  const seededPlayers: SeededPlayer[] = [];

  // We'll batch-insert the join-table rows via raw SQL for speed
  const joinRows: { teamId: string; playerId: string }[] = [];

  for (const team of teams) {
    const playerCount = faker.number.int({ min: 12, max: 18 });

    for (let i = 0; i < playerCount; i++) {
      const id = generateUUID();
      const firstname = faker.person.firstName('male');
      const lastname = faker.person.lastName();

      // date_of_birth in the team's birth year ± 0-1 year
      const year = team.birthyear + faker.number.int({ min: -1, max: 0 });
      const dob = toDateString(
        new Date(year, faker.number.int({ min: 0, max: 11 }), faker.number.int({ min: 1, max: 28 })),
      );

      await playerRepository.insert({
        id,
        firstname,
        lastname,
        dateOfBirth: dob,
        createdAt: seedDatePast(),
      });

      joinRows.push({ teamId: team.id, playerId: id });

      seededPlayers.push({ id, firstname, lastname, teamIds: [team.id] });
    }
  }

  // Bulk-insert join table
  if (joinRows.length > 0) {
    const chunks = chunkArray(joinRows, 500);
    for (const chunk of chunks) {
      const values = chunk
        .map((r) => `('${r.teamId}', '${r.playerId}')`)
        .join(', ');
      await dataSource.query(
        `INSERT INTO team_players (team_id, player_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      );
    }
  }

  console.log(`✅ Seeded ${seededPlayers.length} players (${joinRows.length} team-player links)`);
  return seededPlayers;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
