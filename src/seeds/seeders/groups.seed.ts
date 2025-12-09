import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { generateUUID } from '../utils/helpers';

export interface SeededGroup {
  id: string;
  tournamentId: string;
  groupLetter: string;
  teams: string[];
}

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export async function seedGroups(
  dataSource: DataSource,
  tournamentIds: { id: string; status: string; drawCompleted: boolean }[],
  registrationsByTournament: Map<string, { clubId: string; status: string }[]>,
): Promise<SeededGroup[]> {
  const groupRepository = dataSource.getRepository('Group');
  
  const seededGroups: SeededGroup[] = [];
  
  // Only create groups for tournaments that have draw completed
  const tournamentsWithDraw = tournamentIds.filter(
    t => t.drawCompleted && ['PUBLISHED', 'ONGOING', 'COMPLETED'].includes(t.status)
  );
  
  for (const tournament of tournamentsWithDraw) {
    const registrations = registrationsByTournament.get(tournament.id) || [];
    const approvedClubs = registrations
      .filter(r => r.status === 'APPROVED')
      .map(r => r.clubId);
    
    if (approvedClubs.length < 4) continue; // Need at least 4 teams for groups
    
    // Determine number of groups based on team count
    const teamCount = approvedClubs.length;
    let numGroups: number;
    if (teamCount <= 8) {
      numGroups = 2;
    } else if (teamCount <= 16) {
      numGroups = 4;
    } else if (teamCount <= 24) {
      numGroups = 6;
    } else {
      numGroups = 8;
    }
    
    // Shuffle clubs for random distribution
    const shuffledClubs = [...approvedClubs].sort(() => Math.random() - 0.5);
    
    // Distribute teams across groups
    const teamsPerGroup = Math.ceil(shuffledClubs.length / numGroups);
    
    for (let i = 0; i < numGroups; i++) {
      const groupTeams = shuffledClubs.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
      
      if (groupTeams.length === 0) continue;
      
      const groupId = generateUUID();
      const groupLetter = GROUP_LETTERS[i];
      
      await groupRepository.insert({
        id: groupId,
        tournament: { id: tournament.id },
        groupLetter,
        teams: groupTeams,
        groupOrder: i,
        createdAt: faker.date.recent({ days: 30 }),
      });
      
      seededGroups.push({
        id: groupId,
        tournamentId: tournament.id,
        groupLetter,
        teams: groupTeams,
      });
    }
  }
  
  console.log(`✅ Seeded ${seededGroups.length} groups`);
  return seededGroups;
}
