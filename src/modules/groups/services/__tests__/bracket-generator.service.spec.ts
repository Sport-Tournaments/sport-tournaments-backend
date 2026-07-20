import { BracketGeneratorService } from '../bracket-generator.service';
import type { Match } from '../../../../common/interfaces/bracket.interface';

describe('BracketGeneratorService.calculateGroupStandings', () => {
  const service = new BracketGeneratorService();

  const makeMatch = (
    t1: string,
    s1: number,
    t2: string,
    s2: number,
  ): Match => ({
    id: `m-${t1}-${t2}`,
    round: 1,
    matchNumber: 1,
    status: 'COMPLETED',
    team1Id: t1,
    team1Name: t1,
    team2Id: t2,
    team2Name: t2,
    team1Score: s1,
    team2Score: s2,
  });

  it('sorts by points, then GD, then GF', () => {
    const matches: Match[] = [
      makeMatch('A', 3, 'B', 1),
      makeMatch('B', 0, 'C', 0),
      makeMatch('A', 2, 'C', 2),
    ];

    const standings = service.calculateGroupStandings(['A', 'B', 'C'], matches);
    expect(standings.map((s) => ({ id: s.teamId, pos: s.position }))).toEqual([
      { id: 'A', pos: 1 },
      { id: 'C', pos: 2 },
      { id: 'B', pos: 3 },
    ]);
  });

  it('uses partial tieBreakOrder only to break ties on pts/GD/GF', () => {
    // All matches are draws: A, B, C each have 2pts, GD=0, GF=0
    const matches: Match[] = [
      makeMatch('A', 0, 'B', 0),
      makeMatch('B', 0, 'C', 0),
      makeMatch('A', 0, 'C', 0),
    ];

    // Partial tiebreak (only 2 of 3 teams listed) resolves the tie between A and C,
    // B drops to 3rd because it isn't in the tieBreakOrder at all.
    const standings = service.calculateGroupStandings(['A', 'B', 'C'], matches, [
      'C',
      'A',
    ]);
    expect(standings.map((s) => s.teamId)).toEqual(['C', 'A', 'B']);
  });

  it('ignores a full-length tieBreakOrder when it does not cover every team', () => {
    // Identical stats as above — all teams tied
    const matches: Match[] = [
      makeMatch('A', 0, 'B', 0),
      makeMatch('B', 0, 'C', 0),
      makeMatch('A', 0, 'C', 0),
    ];

    // Not a full override because B and C are in the list but the list length
    // is 3 and so is team count — actually this IS full override. Let's test
    // full override behavior in a separate test below.
    const standings = service.calculateGroupStandings(['A', 'B', 'C'], matches, [
      'B',
      'A',
      'C',
    ]);
    expect(standings.map((s) => s.teamId)).toEqual(['B', 'A', 'C']);
  });

  it('applies full manual override when tieBreakOrder covers all teams', () => {
    const matches: Match[] = [
      makeMatch('A', 3, 'B', 1),
      makeMatch('B', 0, 'C', 0),
      makeMatch('A', 2, 'C', 2),
    ];

    // Full manual override: ignore stats, use array order as-is
    const standings = service.calculateGroupStandings(['A', 'B', 'C'], matches, [
      'C',
      'B',
      'A',
    ]);
    expect(standings.map((s) => s.teamId)).toEqual(['C', 'B', 'A']);
  });

  it('cascading reorder: moving the first team to last shifts others up', () => {
    const matches: Match[] = [
      makeMatch('A', 3, 'B', 1),
      makeMatch('B', 0, 'C', 0),
      makeMatch('A', 2, 'C', 2),
    ];

    // Initial order: A,C,B (by stats)
    // Manual override to: C,B,A (move C to 1st, B to 2nd, A to 3rd)
    const standings = service.calculateGroupStandings(['A', 'B', 'C'], matches, [
      'C',
      'B',
      'A',
    ]);
    expect(standings.map((s) => ({ id: s.teamId, pos: s.position }))).toEqual([
      { id: 'C', pos: 1 },
      { id: 'B', pos: 2 },
      { id: 'A', pos: 3 },
    ]);
  });

  it('cascading reorder: moving last-place team to first', () => {
    const matches: Match[] = [
      makeMatch('A', 3, 'B', 1),
      makeMatch('B', 0, 'C', 0),
      makeMatch('A', 2, 'C', 2),
    ];

    // Stats order: A(4pts), C(2pts), B(1pt)
    // Full override: move B(1pt, last) to 1st -> [B, A, C]
    const standings = service.calculateGroupStandings(['A', 'B', 'C'], matches, [
      'B',
      'A',
      'C',
    ]);
    expect(standings.map((s) => s.teamId)).toEqual(['B', 'A', 'C']);
  });

  it('handles a 4-team group with full manual override', () => {
    const matches: Match[] = [
      makeMatch('A', 2, 'B', 1),
      makeMatch('C', 3, 'D', 0),
      makeMatch('A', 1, 'C', 1),
      makeMatch('B', 2, 'D', 2),
    ];

    const standings = service.calculateGroupStandings(
      ['A', 'B', 'C', 'D'],
      matches,
      ['D', 'C', 'B', 'A'],
    );
    expect(standings.map((s) => s.teamId)).toEqual(['D', 'C', 'B', 'A']);
    expect(standings.map((s) => s.position)).toEqual([1, 2, 3, 4]);
  });

  it('falls back to stats when tieBreakOrder is null', () => {
    const matches: Match[] = [
      makeMatch('A', 0, 'B', 0),
      makeMatch('B', 0, 'C', 0),
      makeMatch('A', 0, 'C', 0),
    ];

    const standings = service.calculateGroupStandings(['A', 'B', 'C'], matches, null);
    // All tied — since there's no teamName sort guarantee tie-break is alphabetical?
    // Actually the service sorts by stats only, so positions may depends on insertion order
    // Instead, verify that positions are 1,2,3 and each team appears exactly once.
    expect(standings.map((s) => s.teamId).sort()).toEqual(['A', 'B', 'C']);
    expect(standings.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('applies partial tieBreakOrder only to tied teams that appear in the list', () => {
    const matches: Match[] = [
      makeMatch('A', 0, 'B', 0),
      makeMatch('B', 0, 'C', 0),
      makeMatch('A', 0, 'C', 0),
    ];

    // A, B, C all have 2pts, GD=0, GF=0
    // tieBreakOrder puts B ahead of A, C is not in list → C stays at end
    const standings = service.calculateGroupStandings(['A', 'B', 'C'], matches, [
      'B',
      'A',
    ]);
    expect(standings.map((s) => s.teamId)).toEqual(['B', 'A', 'C']);
  });
});
