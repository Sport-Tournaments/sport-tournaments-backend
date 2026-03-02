import { Injectable } from '@nestjs/common';

export enum BracketType {
  GROUPS_ONLY = 'GROUPS_ONLY',
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
  ROUND_ROBIN = 'ROUND_ROBIN',
  GROUPS_PLUS_KNOCKOUT = 'GROUPS_PLUS_KNOCKOUT',
  LEAGUE = 'LEAGUE',
}

export interface Match {
  id: string;
  round: number;
  matchNumber: number;
  team1Id?: string;
  team2Id?: string;
  team1Name?: string;
  team2Name?: string;
  team1Score?: number;
  team2Score?: number;
  winnerId?: string;
  loserId?: string;
  manualWinnerId?: string; // Manual override: organizer picks advancing team
  isManualOverride?: boolean; // Flag indicating manual advancement override
  scheduledAt?: Date;
  courtNumber?: number; // BE-07: court/field assignment
  locationId?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  nextMatchId?: string;
  loserNextMatchId?: string; // For double elimination
  autoAdvance?: boolean; // BYE match — top-seeded team advances automatically (BE-SE-01)
}

export interface PlayoffRound {
  roundNumber: number;
  roundName: string;
  matches: Match[];
  bracket?: 'winners' | 'losers' | 'grand_final'; // DE bracket column (BE-DE-01)
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
      leagueLegs?: number;
    } = {},
  ): BracketData {
    const seed = options.seed || this.generateSeed();

    switch (type) {
      case BracketType.GROUPS_ONLY:
        return this.generateGroupsOnlyBracket(
          teamCount,
          options.groupCount,
          seed,
        );

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

      case BracketType.LEAGUE:
        return this.generateLeagueBracket(teamCount, options.leagueLegs ?? 2, seed);

      case BracketType.GROUPS_PLUS_KNOCKOUT:
        return this.generateGroupsWithKnockoutBracket(
          teamCount,
          options.groupCount,
          options.advancingPerGroup || 2,
          options.thirdPlaceMatch,
          seed,
        );

      default:
        return this.generateGroupsOnlyBracket(
          teamCount,
          options.groupCount,
          seed,
        );
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
   * Single elimination bracket — supports non-power-of-2 team counts via BYE slots (BE-SE-01)
   */
  private generateSingleEliminationBracket(
    teamCount: number,
    thirdPlaceMatch?: boolean,
    seed?: string,
  ): BracketData {
    // Next power of 2 ≥ teamCount; extra slots become BYE matches in round 1
    const roundsNeeded = Math.ceil(Math.log2(teamCount));
    const bracketSize = Math.pow(2, roundsNeeded);
    const byeCount = bracketSize - teamCount; // number of first-round BYEs

    const playoffRounds: PlayoffRound[] = [];
    let matchId = 1;

    for (let round = 1; round <= roundsNeeded; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundName = this.getRoundName(round, roundsNeeded);

      const matches: Match[] = [];
      for (let i = 0; i < matchesInRound; i++) {
        const isByeMatch = round === 1 && i < byeCount;
        matches.push({
          id: `match_${matchId++}`,
          round,
          matchNumber: i + 1,
          status: 'PENDING',
          // BYE: top-seeded team (team1) auto-advances — no real opponent
          ...(isByeMatch ? { team2Id: 'BYE', autoAdvance: true } : {}),
        });
      }

      playoffRounds.push({
        roundNumber: round,
        roundName,
        matches,
        bracket: 'winners',
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
   * Double elimination bracket — wires loserNextMatchId from winners rounds into
   * the corresponding losers rounds (BE-DE-01).
   *
   * Structure for N teams (roundsNeeded = ceil(log2(N))):
   *   playoffRounds[0..roundsNeeded-1]               = Winners bracket rounds
   *   playoffRounds[roundsNeeded..roundsNeeded+LR-1]  = Losers bracket rounds (LR = 2*roundsNeeded-2)
   *   playoffRounds[roundsNeeded+LR]                  = Grand Final
   *
   * Loser routing:
   *   WR round 0   → LR round 0 (losers play each other, pairs of 2 per LR match)
   *   WR round r>0 → LR round r (1:1 match index)
   *   WR final     → last LR round (WF loser faces LR survivor)
   */
  private generateDoubleEliminationBracket(
    teamCount: number,
    seed?: string,
  ): BracketData {
    const roundsNeeded = Math.ceil(Math.log2(teamCount));
    const bracketSize = Math.pow(2, roundsNeeded);

    const playoffRounds: PlayoffRound[] = [];
    let matchId = 1;

    // ── Winners bracket rounds ──────────────────────────────────────────────
    for (let round = 1; round <= roundsNeeded; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      const roundName = round === roundsNeeded
        ? 'Winners Final'
        : `Winners Round ${round}`;

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
        bracket: 'winners',
      });
    }

    // ── Losers bracket rounds ───────────────────────────────────────────────
    const loserRounds = 2 * roundsNeeded - 2;
    for (let round = 1; round <= loserRounds; round++) {
      const matchesInRound = Math.ceil(
        bracketSize / Math.pow(2, Math.ceil(round / 2) + 1),
      );
      const roundName = round === loserRounds
        ? 'Losers Final'
        : `Losers Round ${round}`;

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
        bracket: 'losers',
      });
    }

    // ── Grand Final ─────────────────────────────────────────────────────────
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
      bracket: 'grand_final',
    });

    // ── Wire loserNextMatchId on winners-bracket matches (BE-DE-01) ─────────
    // WR round r (0-indexed) → LR round at playoffRounds[roundsNeeded + lrOffset(r)]
    // WR round 0: losers pair up (2 losers per LR match)  → LR round 0
    // WR round r (0 < r < roundsNeeded-1): losers enter 1:1 → LR round r
    // WR final (r = roundsNeeded-1): loser → last LR round
    for (let r = 0; r < roundsNeeded; r++) {
      const wrRound = playoffRounds[r];

      let lrArrayIdx: number;
      if (r === roundsNeeded - 1) {
        // WF loser → last LR round (Losers Final)
        lrArrayIdx = roundsNeeded + loserRounds - 1;
      } else {
        lrArrayIdx = roundsNeeded + r;
      }

      const lrRound = playoffRounds[lrArrayIdx];
      if (!lrRound) continue;

      // WR round 0: pairs of losers feed into each LR match (factor = 2)
      // All other WR rounds: 1:1 mapping (factor = 1)
      const factor = r === 0 ? 2 : 1;

      wrRound.matches.forEach((match, i) => {
        const targetIdx = Math.floor(i / factor);
        if (lrRound.matches[targetIdx]) {
          match.loserNextMatchId = lrRound.matches[targetIdx].id;
        }
      });
    }

    return {
      type: BracketType.DOUBLE_ELIMINATION,
      playoffRounds,
      seed,
      generatedAt: new Date(),
    };
  }

  /**
   * Round-robin using the circle/wheel rotation algorithm (Berger tables) — PM-01.
   *
   * For N teams the schedule contains N-1 rounds (N even) or N rounds (N odd,
   * where a dummy "BYE" team is added).  Each round has ⌊N/2⌋ matches and no
   * team plays more than once per round.
   *
   * Algorithm (0-indexed teams):
   *   fix team 0; rotating = [1, 2, ..., n-1]
   *   round r (0..n-2):
   *     match 0: team 0 vs rotating[(r + n/2 - 1) % (n-1)]
   *     match i (i=1..n/2-1): rotating[(r+i-1) % (n-1)] vs rotating[(r+n-2-i) % (n-1)]
   *
   * Matches involving the BYE dummy (index ≥ teamCount) are filtered out.
   */
  private generateRoundRobinBracket(
    teamCount: number,
    seed?: string,
  ): BracketData {
    // n must be even; if odd, add one dummy slot
    const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
    const matches: Match[] = [];
    let matchId = 1;

    for (let r = 0; r < n - 1; r++) {
      const round = r + 1;
      let matchInRound = 0;

      // Pair: fixed team (0) vs rotating slot (r + n/2 - 1) % (n-1)
      const oppRotIdx = (r + n / 2 - 1) % (n - 1);
      const opp = oppRotIdx + 1; // actual team index (rotating = teams 1..n-1)
      if (opp < teamCount) {
        // 0 is fixed team, always a real team
        matches.push({
          id: `rr_${matchId++}`,
          round,
          matchNumber: ++matchInRound,
          status: 'PENDING',
        });
      }

      // Remaining pairs
      for (let i = 1; i < n / 2; i++) {
        const rIdx1 = (r + i - 1 + (n - 1)) % (n - 1);
        const rIdx2 = (r + n - 2 - i + (n - 1)) % (n - 1);
        const ta = rIdx1 + 1;
        const tb = rIdx2 + 1;
        if (ta < teamCount && tb < teamCount) {
          matches.push({
            id: `rr_${matchId++}`,
            round,
            matchNumber: ++matchInRound,
            status: 'PENDING',
          });
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
   * League format — full round-robin with configurable number of legs (BE-11).
   *
   * A single-leg league uses the wheel-rotation schedule (see generateRoundRobinBracket).
   * For a two-leg (home/away) league the fixtures are repeated with teams swapped,
   * placed in the subsequent rounds.
   */
  private generateLeagueBracket(
    teamCount: number,
    legs: number = 2,
    seed?: string,
  ): BracketData {
    // Build one-leg schedule using the wheel rotation algorithm
    const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
    const firstLegMatches: Match[] = [];
    let matchId = 1;

    for (let r = 0; r < n - 1; r++) {
      const round = r + 1;
      let matchInRound = 0;

      const oppRotIdx = (r + n / 2 - 1) % (n - 1);
      const opp = oppRotIdx + 1;
      if (opp < teamCount) {
        firstLegMatches.push({
          id: `leg1_${matchId++}`,
          round,
          matchNumber: ++matchInRound,
          status: 'PENDING',
        });
      }

      for (let i = 1; i < n / 2; i++) {
        const rIdx1 = (r + i - 1 + (n - 1)) % (n - 1);
        const rIdx2 = (r + n - 2 - i + (n - 1)) % (n - 1);
        const ta = rIdx1 + 1;
        const tb = rIdx2 + 1;
        if (ta < teamCount && tb < teamCount) {
          firstLegMatches.push({
            id: `leg1_${matchId++}`,
            round,
            matchNumber: ++matchInRound,
            status: 'PENDING',
          });
        }
      }
    }

    let allMatches: Match[] = firstLegMatches;

    if (legs > 1) {
      // Second leg: swap home/away, offset rounds by first-leg round count
      const firstLegRoundCount = firstLegMatches.reduce(
        (max, m) => Math.max(max, m.round),
        0,
      );
      const secondLegMatches = firstLegMatches.map((m, idx) => ({
        ...m,
        id: `leg2_${idx + 1}`,
        round: m.round + firstLegRoundCount,
        // team1/team2 are assigned at draw time; preserve slot swap via metadata
        team1Id: m.team2Id,
        team2Id: m.team1Id,
      }));
      allMatches = [...firstLegMatches, ...secondLegMatches];
    }

    return {
      type: BracketType.LEAGUE,
      matches: allMatches,
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
    // Find the third place round if it exists
    const thirdPlaceRound = playoffRounds.find(
      (r) => r.roundName === 'Third Place',
    );
    const thirdPlaceMatchId = thirdPlaceRound?.matches?.[0]?.id;

    // Find the semi-finals round (the round right before the Final)
    const finalRound = playoffRounds.find((r) => r.roundName === 'Final');

    for (let i = 0; i < playoffRounds.length - 1; i++) {
      const currentRound = playoffRounds[i];
      const nextRound = playoffRounds[i + 1];

      // Skip third place match round for winner linking
      if (nextRound.roundName === 'Third Place') continue;

      currentRound.matches.forEach((match, index) => {
        const nextMatchIndex = Math.floor(index / 2);
        if (nextRound.matches[nextMatchIndex]) {
          match.nextMatchId = nextRound.matches[nextMatchIndex].id;
        }

        // Link semi-final losers to third place match
        if (
          thirdPlaceMatchId &&
          nextRound.roundName === 'Final'
        ) {
          match.loserNextMatchId = thirdPlaceMatchId;
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
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
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
      if (b.goalDifference !== a.goalDifference)
        return b.goalDifference - a.goalDifference;
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
   * Seed advancing teams into the knockout bracket using cross-group interleaving (PM-02).
   *
   * Standard 4-group pattern (works for any even number of groups):
   *   QF1: 1A v 2B     QF2: 1C v 2D
   *   QF3: 2A v 1B     QF4: 2C v 1D
   *
   * This ensures group winners avoid each other until at least the semi-finals.
   * Falls back to position-based seeding when the group count is odd or < 2.
   */
  seedTeamsIntoBracket(
    groupStandings: Map<string, GroupStanding[]>,
    advancingPerGroup: number,
    bracketData: BracketData,
  ): BracketData {
    const groupKeys = Array.from(groupStandings.keys());
    const numGroups = groupKeys.length;

    // Separate winners (pos 1) and runners-up (pos 2) per group
    const winners: { teamId: string; groupId: string }[] = [];
    const runnersUp: { teamId: string; groupId: string }[] = [];

    groupKeys.forEach((groupId) => {
      const standings = groupStandings.get(groupId) ?? [];
      standings.slice(0, advancingPerGroup).forEach((s) => {
        if (s.position === 1) winners.push({ teamId: s.teamId, groupId });
        else runnersUp.push({ teamId: s.teamId, groupId });
      });
    });

    // Build ordered list of match seeds using cross-group interleaving
    const matchSeeds: Array<[string | undefined, string | undefined]> = [];

    if (numGroups >= 2 && numGroups % 2 === 0) {
      // First half: winners[even-idx] vs runnersUp[odd-idx] → 1A v 2B, 1C v 2D ...
      for (let i = 0; i + 1 < numGroups; i += 2) {
        matchSeeds.push([winners[i]?.teamId, runnersUp[i + 1]?.teamId]);
      }
      // Second half: runnersUp[even-idx] vs winners[odd-idx] → 2A v 1B, 2C v 1D ...
      for (let i = 0; i + 1 < numGroups; i += 2) {
        matchSeeds.push([runnersUp[i]?.teamId, winners[i + 1]?.teamId]);
      }
    } else {
      // Fallback: sort all advancing teams by position, seed best vs worst
      const all = [...winners, ...runnersUp];
      for (let i = 0; i < Math.floor(all.length / 2); i++) {
        matchSeeds.push([all[i]?.teamId, all[all.length - 1 - i]?.teamId]);
      }
    }

    // Apply seeds to first knockout round
    if (bracketData.playoffRounds && bracketData.playoffRounds.length > 0) {
      const firstRound = bracketData.playoffRounds[0];
      firstRound.matches.forEach((match, index) => {
        if (matchSeeds[index]) {
          if (matchSeeds[index][0]) match.team1Id = matchSeeds[index][0];
          if (matchSeeds[index][1]) match.team2Id = matchSeeds[index][1];
        }
      });
    }

    return bracketData;
  }
}
