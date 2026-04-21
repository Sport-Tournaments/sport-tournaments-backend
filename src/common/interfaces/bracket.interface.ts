/**
 * Shared bracket interfaces used across the application.
 *
 * These types define the runtime structure of bracket data stored in
 * Tournament.bracketData (JSON column). Two storage formats exist:
 *
 * - **Flat**: `BracketData` — single age group or legacy tournaments
 * - **Per-age-group keyed**: `Record<string, BracketData>` — current
 *   multi-age-group format, where each key is an ageGroupId
 *
 * Use `getBracketForAgeGroup()` in GroupsService to read safely.
 */

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
  leg1Team1Score?: number | null;
  leg1Team2Score?: number | null;
  leg2Team1Score?: number | null;
  leg2Team2Score?: number | null;
  winnerId?: string;
  loserId?: string;
  manualWinnerId?: string;
  isManualOverride?: boolean;
  hasPenalties?: boolean;
  penaltyTeam1Score?: number;
  penaltyTeam2Score?: number;
  scheduledAt?: Date;
  courtNumber?: number;
  fieldName?: string;
  locationId?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  nextMatchId?: string;
  loserNextMatchId?: string;
  autoAdvance?: boolean;
  groupLetter?: string;
}

export interface PlayoffRound {
  roundNumber: number;
  roundName: string;
  matches: Match[];
  bracket?: 'winners' | 'losers' | 'grand_final' | 'third_place';
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
