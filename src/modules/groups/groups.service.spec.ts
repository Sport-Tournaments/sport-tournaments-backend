import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupsService } from './groups.service';
import { BracketGeneratorService } from './services/bracket-generator.service';
import { Group } from './entities/group.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentAgeGroup } from '../tournaments/entities/tournament-age-group.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { ExecuteDrawDto } from './dto';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  TournamentStatus,
  RegistrationStatus,
  UserRole,
} from '../../common/enums';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-seed'),
}));

describe('GroupsService', () => {
  let service: GroupsService;
  let mockBracketGeneratorService: {
    generateBracket: jest.Mock;
    calculateGroupStandings: jest.Mock;
    seedTeamsIntoBracket: jest.Mock;
  };

  const mockTournament: Partial<Tournament> = {
    id: 'tournament-1',
    name: 'Test Tournament',
    status: TournamentStatus.PUBLISHED,
    maxTeams: 16,
    currentTeams: 8,
    organizerId: 'organizer-1',
    drawCompleted: false,
  };

  const mockRegistrations = [
    {
      id: 'reg-1',
      tournamentId: 'tournament-1',
      clubId: 'club-1',
      status: RegistrationStatus.APPROVED,
      club: { id: 'club-1', name: 'Team A' },
    },
    {
      id: 'reg-2',
      tournamentId: 'tournament-1',
      clubId: 'club-2',
      status: RegistrationStatus.APPROVED,
      club: { id: 'club-2', name: 'Team B' },
    },
    {
      id: 'reg-3',
      tournamentId: 'tournament-1',
      clubId: 'club-3',
      status: RegistrationStatus.APPROVED,
      club: { id: 'club-3', name: 'Team C' },
    },
    {
      id: 'reg-4',
      tournamentId: 'tournament-1',
      clubId: 'club-4',
      status: RegistrationStatus.APPROVED,
      club: { id: 'club-4', name: 'Team D' },
    },
  ];

  const mockGroup: Partial<Group> = {
    id: 'group-1',
    tournamentId: 'tournament-1',
    groupLetter: 'A',
    teams: ['reg-1', 'reg-2'],
    groupOrder: 1,
  };

  const mockGroupsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockAgeGroupRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockTournamentsRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  };

  const mockRegistrationsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    mockBracketGeneratorService = {
      generateBracket: jest.fn(),
      calculateGroupStandings: jest.fn(),
      seedTeamsIntoBracket: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupsRepo,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentsRepo,
        },
        {
          provide: getRepositoryToken(TournamentAgeGroup),
          useValue: mockAgeGroupRepo,
        },
        {
          provide: getRepositoryToken(Registration),
          useValue: mockRegistrationsRepo,
        },
        {
          provide: BracketGeneratorService,
          useValue: mockBracketGeneratorService,
        },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeDraw', () => {
    const executeDrawDto: ExecuteDrawDto = {
      numberOfGroups: 2,
    };

    it('should execute draw successfully', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationsRepo.find.mockResolvedValue(mockRegistrations);
      mockGroupsRepo.delete.mockResolvedValue({ affected: 0 });
      mockGroupsRepo.create.mockImplementation((data: Partial<Group>) => data);
      mockGroupsRepo.save.mockImplementation(
        (groups: Partial<Group>[]): Partial<Group>[] =>
          groups.map((g, i: number) => ({ ...g, id: `group-${i + 1}` })),
      );
      mockRegistrationsRepo.update.mockResolvedValue({ affected: 1 });
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.executeDraw(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        executeDrawDto,
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(mockTournamentsRepo.update).toHaveBeenCalledWith('tournament-1', {
        drawCompleted: true,
        drawSeed: expect.any(String) as unknown,
      });
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.executeDraw(
          'non-existent',
          'organizer-1',
          UserRole.ORGANIZER,
          executeDrawDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not tournament organizer', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.executeDraw(
          'tournament-1',
          'other-user',
          UserRole.ORGANIZER,
          executeDrawDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to execute draw for any tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationsRepo.find.mockResolvedValue(mockRegistrations);
      mockGroupsRepo.delete.mockResolvedValue({ affected: 0 });
      mockGroupsRepo.create.mockImplementation((data: Partial<Group>) => data);
      mockGroupsRepo.save.mockImplementation(
        (groups: Partial<Group>[]): Partial<Group>[] =>
          groups.map((g, i: number) => ({ ...g, id: `group-${i + 1}` })),
      );
      mockRegistrationsRepo.update.mockResolvedValue({ affected: 1 });
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.executeDraw(
        'tournament-1',
        'admin-user',
        UserRole.ADMIN,
        executeDrawDto,
      );

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if draw already completed', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        drawCompleted: true,
      });

      await expect(
        service.executeDraw(
          'tournament-1',
          'organizer-1',
          UserRole.ORGANIZER,
          executeDrawDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if tournament status is invalid', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.DRAFT,
      });

      await expect(
        service.executeDraw(
          'tournament-1',
          'organizer-1',
          UserRole.ORGANIZER,
          executeDrawDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if less than 2 approved teams', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationsRepo.find.mockResolvedValue([mockRegistrations[0]]);

      await expect(
        service.executeDraw(
          'tournament-1',
          'organizer-1',
          UserRole.ORGANIZER,
          executeDrawDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if number of groups exceeds teams', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationsRepo.find.mockResolvedValue([
        mockRegistrations[0],
        mockRegistrations[1],
      ]);

      await expect(
        service.executeDraw('tournament-1', 'organizer-1', UserRole.ORGANIZER, {
          numberOfGroups: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getGroups', () => {
    it('should return groups for a tournament', async () => {
      mockGroupsRepo.find.mockResolvedValue([mockGroup]);
      mockRegistrationsRepo.find.mockResolvedValue(mockRegistrations.slice(0, 2));

      const result = await service.getGroups('tournament-1');

      expect(result).toHaveLength(1);
      expect(result[0].groupLetter).toBe('A');
      expect((result[0] as any).teamDetails).toHaveLength(2);
      expect(mockRegistrationsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['club', 'team'],
        }),
      );
      expect(mockRegistrationsRepo.findOne).not.toHaveBeenCalled();
    });

    it('should prefer team names over club names in matches responses', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketData: {
          type: 'GROUPS_PLUS_KNOCKOUT',
          matches: [
            {
              id: 'grp_A_1',
              round: 1,
              matchNumber: 1,
              groupLetter: 'A',
              team1Id: 'reg-1',
              team2Id: 'reg-2',
              team1Name: 'Club A',
              team2Name: 'Club B',
              status: 'PENDING',
            },
          ],
        },
      });
      mockRegistrationsRepo.find.mockResolvedValue([
        {
          id: 'reg-1',
          club: { name: 'Club A' },
          team: { name: 'Team A' },
        },
        {
          id: 'reg-2',
          club: { name: 'Club B' },
          team: { name: 'Team B' },
        },
      ]);

      const result = await service.getMatches('tournament-1');

      expect(result.teams).toEqual([
        { id: 'reg-1', name: 'Team A', clubName: 'Club A' },
        { id: 'reg-2', name: 'Team B', clubName: 'Club B' },
      ]);
      expect(mockRegistrationsRepo.find).toHaveBeenCalledWith({
        where: {
          tournamentId: 'tournament-1',
          status: RegistrationStatus.APPROVED,
        },
        relations: ['club', 'team'],
      });
    });

    it('should return empty array if no groups exist', async () => {
      mockGroupsRepo.find.mockResolvedValue([]);

      const result = await service.getGroups('tournament-1');

      expect(result).toHaveLength(0);
    });
  });


  describe('swapMatchTeams', () => {
    it('should swap two pending teams inside placement bracket slots', async () => {
      const bracketData: any = {
        type: 'GROUPS_PLUS_KNOCKOUT',
        matches: [],
        playoffRounds: [],
        placementBrackets: [
          {
            key: 'placement-1-4',
            label: '1-4',
            rangeStart: 1,
            rangeEnd: 4,
            playoffRounds: [
              {
                roundNumber: 1,
                roundName: '1-4',
                matches: [
                  {
                    id: 'placement-1-4-r1-m1',
                    round: 1,
                    matchNumber: 1,
                    status: 'PENDING',
                    team1Score: null,
                    team2Score: null,
                    winnerId: null,
                    team1Id: 'reg-1',
                    team1Name: 'Team 1',
                    team2Id: 'reg-2',
                    team2Name: 'Team 2',
                  },
                  {
                    id: 'placement-1-4-r1-m2',
                    round: 1,
                    matchNumber: 2,
                    status: 'PENDING',
                    team1Id: 'reg-3',
                    team1Name: 'Team 3',
                    team2Id: 'reg-4',
                    team2Name: 'Team 4',
                  },
                ],
              },
            ],
          },
        ],
      };
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketData: { 'age-group-1': bracketData },
      });
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.swapMatchTeams(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        {
          sourceMatchId: 'placement-1-4-r1-m1',
          sourceSlot: 'team1',
          targetMatchId: 'placement-1-4-r1-m2',
          targetSlot: 'team2',
        },
        'age-group-1',
      );

      const [firstMatch, secondMatch] =
        bracketData.placementBrackets[0].playoffRounds[0].matches;
      expect(firstMatch.team1Id).toBe('reg-4');
      expect(firstMatch.team1Name).toBe('Team 4');
      expect(secondMatch.team2Id).toBe('reg-1');
      expect(secondMatch.team2Name).toBe('Team 1');
      expect(result.bracketUpdated).toBe(true);
      expect(mockTournamentsRepo.update).toHaveBeenCalledWith('tournament-1', {
        bracketData: { 'age-group-1': bracketData },
      });
    });

    it('should swap provisional source slots before group matches are completed', async () => {
      const bracketData: any = {
        type: 'GROUPS_PLUS_KNOCKOUT',
        matches: [
          {
            id: 'grp_A_1',
            groupLetter: 'A',
            status: 'PENDING',
          },
        ],
        playoffRounds: [],
        placementBrackets: [
          {
            key: 'placement-1-4',
            label: '1-4',
            rangeStart: 1,
            rangeEnd: 4,
            playoffRounds: [
              {
                roundNumber: 1,
                roundName: '1-4',
                matches: [
                  {
                    id: 'placement-1-4-r1-m1',
                    round: 1,
                    matchNumber: 1,
                    status: 'PENDING',
                    team1Name: 'A1',
                    team1SourceSlot: 'A1',
                    team2Name: 'B2',
                    team2SourceSlot: 'B2',
                  },
                  {
                    id: 'placement-1-4-r1-m2',
                    round: 1,
                    matchNumber: 2,
                    status: 'PENDING',
                    team1Name: 'A2',
                    team1SourceSlot: 'A2',
                    team2Name: 'B1',
                    team2SourceSlot: 'B1',
                  },
                ],
              },
            ],
          },
        ],
      };
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketData: { 'age-group-1': bracketData },
      });
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      await service.swapMatchTeams(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        {
          sourceMatchId: 'placement-1-4-r1-m1',
          sourceSlot: 'team1',
          targetMatchId: 'placement-1-4-r1-m2',
          targetSlot: 'team2',
        },
        'age-group-1',
      );

      const [firstMatch, secondMatch] =
        bracketData.placementBrackets[0].playoffRounds[0].matches;
      expect(firstMatch.team1Name).toBe('B1');
      expect(firstMatch.team1SourceSlot).toBe('B1');
      expect(secondMatch.team2Name).toBe('A1');
      expect(secondMatch.team2SourceSlot).toBe('A1');
    });

    it('should reject swapping teams from a scored match', async () => {
      const bracketData: any = {
        type: 'GROUPS_PLUS_KNOCKOUT',
        placementBrackets: [
          {
            key: 'placement-1-4',
            label: '1-4',
            rangeStart: 1,
            rangeEnd: 4,
            playoffRounds: [
              {
                roundNumber: 1,
                roundName: '1-4',
                matches: [
                  {
                    id: 'm1',
                    round: 1,
                    matchNumber: 1,
                    status: 'COMPLETED',
                    team1Id: 'reg-1',
                    team1Score: 1,
                    team2Id: 'reg-2',
                    team2Score: 0,
                  },
                  {
                    id: 'm2',
                    round: 1,
                    matchNumber: 2,
                    status: 'PENDING',
                    team1Id: 'reg-3',
                    team2Id: 'reg-4',
                  },
                ],
              },
            ],
          },
        ],
      };
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketData,
      });

      await expect(
        service.swapMatchTeams(
          'tournament-1',
          'organizer-1',
          UserRole.ORGANIZER,
          {
            sourceMatchId: 'm1',
            sourceSlot: 'team1',
            targetMatchId: 'm2',
            targetSlot: 'team1',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBracket', () => {
    it('should scope bracket groups and draw status to the requested age group', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        drawCompleted: false,
        ageGroups: [
          { id: 'age-group-1', drawCompleted: true },
          { id: 'age-group-2', drawCompleted: false },
        ],
      });
      mockGroupsRepo.find.mockResolvedValue([
        {
          id: 'group-1',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          teams: [],
        },
      ]);

      const result = await (service as any).getBracket(
        'tournament-1',
        'age-group-1',
      );

      expect(mockGroupsRepo.find).toHaveBeenCalledWith({
        where: { tournamentId: 'tournament-1', ageGroupId: 'age-group-1' },
        order: { groupOrder: 'ASC' },
      });
      expect(result.drawCompleted).toBe(true);
    });
  });

  describe('getMatches', () => {
    it('backfills provisional knockout and placement brackets for existing group bracket data', async () => {
      const ageBracket: any = {
        type: 'GROUPS_PLUS_KNOCKOUT',
        advancingTeamsPerGroup: 1,
        matches: [
          {
            id: 'grp_A_1',
            round: 1,
            matchNumber: 1,
            groupLetter: 'A',
            team1Id: 'reg-1',
            team2Id: 'reg-2',
            status: 'PENDING',
          },
          {
            id: 'grp_B_1',
            round: 1,
            matchNumber: 1,
            groupLetter: 'B',
            team1Id: 'reg-3',
            team2Id: 'reg-4',
            status: 'PENDING',
          },
        ],
      };
      const bracketData = { 'age-group-1': ageBracket };
      const playoffRounds = [
        {
          roundNumber: 1,
          roundName: 'Final',
          matches: [
            { id: 'ko-1', round: 1, matchNumber: 1, status: 'PENDING' },
          ],
        },
      ];
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [
          {
            id: 'age-group-1',
            format: 'GROUPS_PLUS_KNOCKOUT',
          },
        ],
        bracketData,
      });
      mockRegistrationsRepo.find.mockResolvedValue([
        {
          id: 'reg-1',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: 'Team 1' },
        },
      ]);
      mockGroupsRepo.find.mockResolvedValue([
        {
          id: 'group-1',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          groupLetter: 'A',
          teams: ['reg-1', 'reg-2'],
        },
        {
          id: 'group-2',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          groupLetter: 'B',
          teams: ['reg-3', 'reg-4'],
        },
      ]);
      mockBracketGeneratorService.generateBracket.mockReturnValue({
        type: 'SINGLE_ELIMINATION',
        playoffRounds,
      });
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.getMatches('tournament-1', 'age-group-1');

      expect(result.playoffRounds).toBe(playoffRounds);
      expect(result.placementBrackets?.map((bracket) => bracket.label)).toEqual([
        '1-2',
        '3-4',
      ]);
      expect(mockTournamentsRepo.update).toHaveBeenCalledWith('tournament-1', {
        bracketData,
      });
    });

    it('should not return legacy flat bracket matches for a requested age group', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketData: {
          type: 'GROUPS_PLUS_KNOCKOUT',
          matches: [
            {
              id: 'stale-match',
              round: 1,
              matchNumber: 1,
              status: 'PENDING',
              team1Id: 'wrong-age-team-1',
              team2Id: 'wrong-age-team-2',
            },
          ],
        },
      });
      mockRegistrationsRepo.find.mockResolvedValue([
        {
          id: 'reg-1',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: 'Team 1' },
        },
      ]);

      const result = await service.getMatches('tournament-1', 'age-group-1');

      expect(result.matches).toEqual([]);
    });

    it('does not return stale second-leg league matches after leagueLegs is reduced to one', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [
          {
            id: 'age-group-1',
            format: 'LEAGUE',
            leagueLegs: 1,
          },
        ],
        bracketData: {
          'age-group-1': {
            type: 'LEAGUE',
            matches: [
              {
                id: 'leg1_1',
                round: 1,
                matchNumber: 1,
                status: 'PENDING',
                team1Id: 'reg-1',
                team2Id: 'reg-2',
              },
              {
                id: 'leg2_1',
                round: 2,
                matchNumber: 1,
                status: 'PENDING',
                team1Id: 'reg-2',
                team2Id: 'reg-1',
              },
            ],
          },
        },
      });
      mockRegistrationsRepo.find.mockResolvedValue([
        {
          id: 'reg-1',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: 'Team 1' },
        },
        {
          id: 'reg-2',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: 'Team 2' },
        },
      ]);

      const result = await service.getMatches('tournament-1', 'age-group-1');

      expect(result.matches.map((match) => match.id)).toEqual(['leg1_1']);
    });

    it('hides stale bracket matches when the age group format changed', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [
          {
            id: 'age-group-1',
            format: 'SINGLE_ELIMINATION',
          },
        ],
        bracketData: {
          'age-group-1': {
            type: 'LEAGUE',
            matches: [
              {
                id: 'leg1_1',
                round: 1,
                matchNumber: 1,
                status: 'PENDING',
              },
            ],
          },
        },
      });
      mockRegistrationsRepo.find.mockResolvedValue([]);

      const result = await service.getMatches('tournament-1', 'age-group-1');

      expect(result.matches).toEqual([]);
      expect(result.bracketType).toBe('SINGLE_ELIMINATION');
    });
  });
});
