import { DataSource } from 'typeorm';
import {
  faker,
  generateUUID,
  seedDate,
} from '../utils/helpers';

export interface SeededTournamentPot {
  id: string;
  tournamentId: string;
  registrationId: string;
  potNumber: number;
}

/**
 * Seed tournament pots for tournaments with draw completed.
 * Assigns each approved registration to a pot (1-4).
 */
export async function seedTournamentPots(
  dataSource: DataSource,
  tournaments: { id: string; drawCompleted: boolean }[],
  registrationsByTournament: Map<string, { id: string; status: string }[]>,
): Promise<SeededTournamentPot[]> {
  const repo = dataSource.getRepository('TournamentPot');
  const seeded: SeededTournamentPot[] = [];

  const tournamentsWithDraw = tournaments.filter((t) => t.drawCompleted);

  for (const tournament of tournamentsWithDraw) {
    const registrations = (registrationsByTournament.get(tournament.id) || [])
      .filter((r) => r.status === 'APPROVED');

    if (registrations.length < 4) continue;

    // Sort randomly, then assign pots round-robin
    const shuffled = faker.helpers.shuffle([...registrations]);
    const potCount = Math.min(4, Math.ceil(shuffled.length / 4));

    for (let i = 0; i < shuffled.length; i++) {
      const id = generateUUID();
      const potNumber = (i % potCount) + 1;

      await repo.insert({
        id,
        tournament: { id: tournament.id },
        registration: { id: shuffled[i].id },
        potNumber,
        createdAt: seedDate(),
      });

      seeded.push({ id, tournamentId: tournament.id, registrationId: shuffled[i].id, potNumber });
    }
  }

  console.log(`✅ Seeded ${seeded.length} tournament pots`);
  return seeded;
}
