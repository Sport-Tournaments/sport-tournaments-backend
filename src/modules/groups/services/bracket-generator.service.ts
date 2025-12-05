import { Injectable } from '@nestjs/common';

export enum BracketType {
  GROUPS_ONLY = 'GROUPS_ONLY',
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
  ROUND_ROBIN = 'ROUND_ROBIN',
  GROUPS_PLUS_KNOCKOUT = 'GROUPS_PLUS_KNOCKOUT',
}

export interface Match {
  id: string;
  round: number;
  matchNumber: number;
  team1Id?: string;
  team2Id?: string;
  team1Score?: number;
  team2Score?: number;
  winnerId?: string;
  loserId?: string;
  scheduledAt?: Date;
  locationId?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  nextMatchId?: string;
  loserNextMatchId?: string; // For double elimination
}

export interface PlayoffRound {
  roundNumber: number;
  roundName: string;
  matches: Match[];
}

export interface BracketData {
  type: BracketType;
  groupCount?: number;
  teamsPerGroup?: number;
  advancingTeamsPerGroup?: number;
  playoffRounds?: PlayoffRound[];
  matches?: Match[];
  thirdPlaceMatch?: boolean;
  seed?: string;
  generatedAt?: Date;
}

export interface GroupStanding {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
}

@Injectable()
export class BracketGeneratorService {
  /**
   * Generate bracket structure based on type and team count
   */
  generateBracket(
    type: BracketType,
    teamCount: number,
    options: {
      groupCount?: number;
      teamsPerGroup?: number;
      advancingPerGroup?: number;
      thirdPlaceMatch?: boolean;
      seed?: string;
    } = {},
  ): BracketData {
    const seed = options.seed || this.generateSeed();

    switch (type) {
      case BracketType.GROUPS_ONLY:
        return this.generateGroupsOnlyBracket(teamCount, options.groupCount, seed);

      case BracketType.SINGLE_ELIMINATION:
        return this.generateSingleEliminationBracket(
          teamCount,
          options.thirdPlaceMatch,
          seed,
        );

      case BracketType.DOUBLE_ELIMINATION:
        return this.generateDoubleEliminationBracket(teamCount, seed);

      case BracketType.ROUND_ROBIN:
        return this.generateRoundRobinBracket(teamCount, seed);

      case BracketType.GROUPS_PLUS_KNOCKOUT:
        return this.generateGroupsWithKnockoutBracket(
          teamCount,
          options.groupCount,
          options.advancingPerGroup || 2,
          options.thirdPlaceMatch,
          seed,
        );

      default:
        return this.generateGroupsOnlyBracket(teamCount, options.groupCount, seed);
    }
  }

  /**
   * Groups only format - teams play round-robin in groups
   */
  private generateGroupsOnlyBracket(
    teamCount: number,
    groupCount?: number,
    seed?: string,
  ): BracketData {
    const calculatedGroupCount = groupCount || Math.ceil(teamCount / 4);
    const teamsPerGroup = Math.ceil(teamCount / calculatedGroupCount);

    return {
      type: BracketType.GROUPS_ONLY,
      groupCount: calculatedGroupCount,
      teamsPerGroup,
      seed,
      generatedAt: new Date(),
    };
  }

  /**
   * Single elimination bracket
   */
  private generateSingleEliminationBracket(
    teamCount: number,
    thirdPlaceMatch?: boolean,
    seed?: string,
  ): BracketData {
    // Calculate number of rounds needed
    const roundsNeeded = Math.ceil(Math.log2(teamCount));
    const bracketSize = Math.pow(2, roundsNeeded);
    const byes = bracketSize - teamCount;

    const playoffRounds: PlayoffRound[] = [];
    let matchId = 1;

    for (let round = 1; round <= roundsNeeded; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundName = this.getRoundName(round, roundsNeeded);

      const matches: Match[] = [];
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          id: `match_${matchId++}`,
          round,
          matchNumber: i + 1,
          status: 'PENDING',
        });
      }

      playoffRounds.push({
        roundNumber: round,
        roundName,
        matches,
      });
    }

    // Add third place match if requested
    if (thirdPlaceMatch && roundsNeeded >= 2) {
      const thirdPlaceRound: PlayoffRound = {
        roundNumber: roundsNeeded,
        roundName: 'Third Place',
        matches: [
          {
            id: `match_${matchId++}`,
            round: roundsNeeded,
            matchNumber: 1,
            status: 'PENDING',
          },
        ],
      };
      playoffRounds.push(thirdPlaceRound);
    }

    // Link matches (winner advances to next round)
    this.linkSingleEliminationMatches(playoffRounds);

    return {
      type: BracketType.SINGLE_ELIMINATION,
      playoffRounds,
      thirdPlaceMatch,
      seed,
      generatedAt: new Date(),
    };
  }

  /**
   * Double elimination bracket
   */
  private generateDoubleEliminationBracket(
    teamCount: number,
    seed?: string,
  ): BracketData {
    // Winners bracket
    const roundsNeeded = Math.ceil(Math.log2(teamCount));
    const bracketSize = Math.pow(2, roundsNeeded);

    const playoffRounds: PlayoffRound[] = [];
    let matchId = 1;

    // Winners bracket rounds
    for (let round = 1; round <= roundsNeeded; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundName = `Winners Round ${round}`;

      const matches: Match[] = [];
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          id: `winners_${matchId++}`,
          round,
          matchNumber: i + 1,
          status: 'PENDING',
        });
      }

      playoffRounds.push({
        roundNumber: round,
        roundName,
        matches,
      });
    }

    // Losers bracket rounds (2 * roundsNeeded - 1 rounds)
    const loserRounds = 2 * roundsNeeded - 2;
    for (let round = 1; round <= loserRounds; round++) {
      const matchesInRound = Math.ceil(bracketSize / Math.pow(2, Math.ceil(round / 2) + 1));
      const roundName = `Losers Round ${round}`;

      const matches: Match[] = [];
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          id: `losers_${matchId++}`,
          round: round + roundsNeeded,
          matchNumber: i + 1,
          status: 'PENDING',
        });
      }

      playoffRounds.push({
        roundNumber: round + roundsNeeded,
        roundName,
        matches,
      });
    }

    // Grand finals
    playoffRounds.push({
      roundNumber: roundsNeeded + loserRounds + 1,
      roundName: 'Grand Finals',
      matches: [
        {
          id: `grand_final_${matchId++}`,
          round: roundsNeeded + loserRounds + 1,
          matchNumber: 1,
          status: 'PENDING',
        },
      ],
    });

    return {
      type: BracketType.DOUBLE_ELIMINATION,
      playoffRounds,
      seed,
      generatedAt: new Date(),
    };
  }

  /**
   * Round robin - every team plays every other team
   */
  private generateRoundRobinBracket(
    teamCount: number,
    seed?: string,
  ): BracketData {
    // Total matches = n(n-1)/2
    const totalMatches = (teamCount * (teamCount - 1)) / 2;
    const matches: Match[] = [];
    let matchId = 1;
    let round = 1;
    let matchInRound = 0;

    // Generate all pairs
    for (let i = 0; i < teamCount; i++) {
      for (let j = i + 1; j < teamCount; j++) {
        matches.push({
          id: `match_${matchId++}`,
          round,
          matchNumber: ++matchInRound,
          status: 'PENDING',
        });

        // Max matches per round = floor(teamCount / 2)
        if (matchInRound >= Math.floor(teamCount / 2)) {
          round++;
          matchInRound = 0;
        }
      }
    }

    return {
      type: BracketType.ROUND_ROBIN,
      matches,
      seed,
      generatedAt: new Date(),
    };
  }

  /**
   * Groups stage followed by knockout playoffs
   */
  private generateGroupsWithKnockoutBracket(
    teamCount: number,
    groupCount?: number,
    advancingPerGroup: number = 2,
    thirdPlaceMatch?: boolean,
    seed?: string,
  ): BracketData {
    const calculatedGroupCount = groupCount || Math.ceil(teamCount / 4);
    const teamsPerGroup = Math.ceil(teamCount / calculatedGroupCount);

    // Teams advancing to playoffs
    const playoffTeamCount = calculatedGroupCount * advancingPerGroup;

    // Generate playoff bracket
    const playoffBracket = this.generateSingleEliminationBracket(
      playoffTeamCount,
      thirdPlaceMatch,
      seed,
    );

    return {
      type: BracketType.GROUPS_PLUS_KNOCKOUT,
      groupCount: calculatedGroupCount,
      teamsPerGroup,
      advancingTeamsPerGroup: advancingPerGroup,
      playoffRounds: playoffBracket.playoffRounds,
      thirdPlaceMatch,
      seed,
      generatedAt: new Date(),
    };
  }

  /**
   * Link matches for single elimination (winner advances)
   */
  private linkSingleEliminationMatches(playoffRounds: PlayoffRound[]): void {
    for (let i = 0; i < playoffRounds.length - 1; i++) {
      const currentRound = playoffRounds[i];
      const nextRound = playoffRounds[i + 1];

      // Skip third place match round if it exists
      if (nextRound.roundName === 'Third Place') continue;

      currentRound.matches.forEach((match, index) => {
        const nextMatchIndex = Math.floor(index / 2);
        if (nextRound.matches[nextMatchIndex]) {
          match.nextMatchId = nextRound.matches[nextMatchIndex].id;
        }
      });
    }
  }

  /**
   * Get readable round name
   */
  private getRoundName(round: number, totalRounds: number): string {
    const roundsFromFinal = totalRounds - round;

    switch (roundsFromFinal) {
      case 0:
        return 'Final';
      case 1:
        return 'Semi-Finals';
      case 2:
        return 'Quarter-Finals';
      case 3:
        return 'Round of 16';
      case 4:
        return 'Round of 32';
      default:
        return `Round ${round}`;
    }
  }

  /**
   * Generate a random seed
   */
  private generateSeed(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Calculate group standings from match results
   */
  calculateGroupStandings(
    groupTeamIds: string[],
    matches: Match[],
  ): GroupStanding[] {
    const standings: Map<string, GroupStanding> = new Map();

    // Initialize standings
    groupTeamIds.forEach((teamId, index) => {
      standings.set(teamId, {
        teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        position: index + 1,
      });
    });

    // Process completed matches
    matches
      .filter((m) => m.status === 'COMPLETED' && m.team1Id && m.team2Id)
      .forEach((match) => {
        const team1 = standings.get(match.team1Id!);
        const team2 = standings.get(match.team2Id!);

        if (!team1 || !team2) return;

        const score1 = match.team1Score || 0;
        const score2 = match.team2Score || 0;

        // Update stats
        team1.played++;
        team2.played++;
        team1.goalsFor += score1;
        team1.goalsAgainst += score2;
        team2.goalsFor += score2;
        team2.goalsAgainst += score1;

        if (score1 > score2) {
          team1.won++;
          team1.points += 3;
          team2.lost++;
        } else if (score2 > score1) {
          team2.won++;
          team2.points += 3;
          team1.lost++;
        } else {
          team1.drawn++;
          team2.drawn++;
          team1.points += 1;
          team2.points += 1;
        }

        team1.goalDifference = team1.goalsFor - team1.goalsAgainst;
        team2.goalDifference = team2.goalsFor - team2.goalsAgainst;
      });

    // Sort standings
    const sortedStandings = Array.from(standings.values()).sort((a, b) => {
      // Points
      if (b.points !== a.points) return b.points - a.points;
      // Goal difference
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      // Goals for
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      // Default
      return 0;
    });

    // Update positions
    sortedStandings.forEach((standing, index) => {
      standing.position = index + 1;
    });

    return sortedStandings;
  }

  /**
   * Seed teams into bracket based on group standings
   */
  seedTeamsIntoBracket(
    groupStandings: Map<string, GroupStanding[]>,
    advancingPerGroup: number,
    bracketData: BracketData,
  ): BracketData {
    const advancingTeams: { teamId: string; groupId: string; position: number }[] = [];

    // Collect advancing teams
    groupStandings.forEach((standings, groupId) => {
      standings.slice(0, advancingPerGroup).forEach((standing) => {
        advancingTeams.push({
          teamId: standing.teamId,
          groupId,
          position: standing.position,
        });
      });
    });

    // Sort by position for seeding
    advancingTeams.sort((a, b) => a.position - b.position);

    // Seed into first round matches
    if (bracketData.playoffRounds && bracketData.playoffRounds.length > 0) {
      const firstRound = bracketData.playoffRounds[0];
      
      // Standard seeding: 1st place teams vs 2nd place teams from different groups
      // This is a simplified version - real tournaments have more complex seeding rules
      firstRound.matches.forEach((match, index) => {
        const team1Index = index;
        const team2Index = advancingTeams.length - 1 - index;
        
        if (advancingTeams[team1Index]) {
          match.team1Id = advancingTeams[team1Index].teamId;
        }
        if (advancingTeams[team2Index]) {
          match.team2Id = advancingTeams[team2Index].teamId;
        }
      });
    }

    return bracketData;
  }
}
