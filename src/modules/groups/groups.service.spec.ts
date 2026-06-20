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
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistrations[0]);

      const result = await service.getGroups('tournament-1');

      expect(result).toHaveLength(1);
      expect(result[0].groupLetter).toBe('A');
      expect(mockRegistrationsRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'reg-1' },
        relations: ['club', 'team'],
      });
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

  describe('getBracket', () => {
    it('should return bracket information', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockGroupsRepo.find.mockResolvedValue([mockGroup]);
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistrations[0]);

      const result = await service.getBracket('tournament-1');

      expect(result).toHaveProperty('groups');
      expect(result).toHaveProperty('tournament');
      expect(result).toHaveProperty('drawCompleted');
      expect(result.drawCompleted).toBe(false);
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);

      await expect(service.getBracket('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resetDraw', () => {
    it('should clear scoped bracket data when resetting one age group', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketData: {
          'age-group-1': {
            type: 'GROUPS_PLUS_KNOCKOUT',
            matches: [{ id: 'm1' }],
          },
          'age-group-2': {
            type: 'GROUPS_PLUS_KNOCKOUT',
            matches: [{ id: 'm2' }],
          },
        },
      });
      mockGroupsRepo.delete.mockResolvedValue({ affected: 2 });
      mockRegistrationsRepo.update.mockResolvedValue({ affected: 4 });
      mockAgeGroupRepo.update.mockResolvedValue({ affected: 1 });
      mockTournamentsRepo.save.mockImplementation(
        async (entity: any) => entity,
      );

      await service.resetDraw(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      expect(mockGroupsRepo.delete).toHaveBeenCalledWith({
        tournamentId: 'tournament-1',
        ageGroupId: 'age-group-1',
      });
      expect(mockRegistrationsRepo.update).toHaveBeenCalledWith(
        { tournamentId: 'tournament-1', ageGroupId: 'age-group-1' },
        { groupAssignment: null },
      );
      expect(mockAgeGroupRepo.update).toHaveBeenCalledWith('age-group-1', {
        drawCompleted: false,
        drawSeed: undefined,
      });
      expect(mockTournamentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          bracketData: {
            'age-group-2': {
              type: 'GROUPS_PLUS_KNOCKOUT',
              matches: [{ id: 'm2' }],
            },
          },
        }),
      );
    });

    it('should clear all bracket data on full reset', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        drawCompleted: true,
        drawSeed: 'seed-1',
        bracketData: {
          'age-group-1': {
            type: 'GROUPS_PLUS_KNOCKOUT',
            matches: [{ id: 'm1' }],
          },
        },
      });
      mockGroupsRepo.delete.mockResolvedValue({ affected: 4 });
      mockRegistrationsRepo.update.mockResolvedValue({ affected: 8 });
      mockTournamentsRepo.save.mockImplementation(
        async (entity: any) => entity,
      );

      await service.resetDraw(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
      );

      expect(mockGroupsRepo.delete).toHaveBeenCalledWith({
        tournamentId: 'tournament-1',
      });
      expect(mockTournamentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          drawCompleted: false,
          drawSeed: undefined,
          bracketData: undefined,
        }),
      );
    });
  });

  describe('generateBracket', () => {
    it('should pass persisted leagueLegs to league bracket generation', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [
          {
            id: 'age-group-1',
            format: 'LEAGUE',
            leagueLegs: 1,
          },
        ],
        bracketData: {},
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
      mockBracketGeneratorService.generateBracket.mockReturnValue({
        type: 'LEAGUE',
        matches: [
          { id: 'leg1_1', round: 1, matchNumber: 1, status: 'PENDING' },
        ],
      });
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      await service.generateBracket(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      expect(mockBracketGeneratorService.generateBracket).toHaveBeenCalledWith(
        'LEAGUE',
        2,
        expect.objectContaining({ leagueLegs: 1 }),
      );
    });

    it('should scope group-stage match generation to the requested age group', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [
          {
            id: 'age-group-1',
            format: 'GROUPS_PLUS_KNOCKOUT',
            groupsCount: 2,
            qualifyingTeamsPerGroup: 2,
            drawCompleted: true,
          },
        ],
        bracketData: {},
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
        {
          id: 'reg-3',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: 'Team 3' },
        },
        {
          id: 'reg-4',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: 'Team 4' },
        },
      ]);
      mockBracketGeneratorService.generateBracket.mockReturnValue({
        type: 'GROUPS_PLUS_KNOCKOUT',
        matches: [],
        playoffRounds: [],
      });
      mockGroupsRepo.find.mockResolvedValue([
        {
          id: 'legacy-group',
          tournamentId: 'tournament-1',
          ageGroupId: undefined,
          groupLetter: 'A',
          teams: ['legacy-1', 'legacy-2', 'legacy-3', 'legacy-4'],
        },
        {
          id: 'group-1',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          groupLetter: 'E',
          teams: ['reg-1', 'reg-2'],
        },
        {
          id: 'group-2',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          groupLetter: 'F',
          teams: ['reg-3', 'reg-4'],
        },
      ]);
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.generateBracket(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      expect(mockGroupsRepo.find).toHaveBeenCalledWith({
        where: { tournamentId: 'tournament-1', ageGroupId: 'age-group-1' },
        order: { groupLetter: 'ASC' },
      });
      expect(result.matches).toHaveLength(2);
      expect(
        result.matches.every((match: any) =>
          ['E', 'F'].includes(match.groupLetter),
        ),
      ).toBe(true);
    });

    it('should keep the knockout shell visible for groups plus knockout brackets', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [
          {
            id: 'age-group-1',
            format: 'GROUPS_PLUS_KNOCKOUT',
            groupsCount: 2,
            qualifyingTeamsPerGroup: 1,
            drawCompleted: true,
          },
        ],
        bracketData: {},
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
        {
          id: 'reg-3',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: 'Team 3' },
        },
        {
          id: 'reg-4',
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: 'Team 4' },
        },
      ]);
      const playoffRounds = [
        {
          roundNumber: 1,
          roundName: 'Final',
          matches: [
            { id: 'ko-1', round: 1, matchNumber: 1, status: 'PENDING' },
          ],
        },
      ];
      mockBracketGeneratorService.generateBracket.mockReturnValue({
        type: 'GROUPS_PLUS_KNOCKOUT',
        advancingTeamsPerGroup: 1,
        matches: [],
        playoffRounds,
      });
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
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.generateBracket(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      expect(result.playoffRounds).toBe(playoffRounds);
      expect(mockTournamentsRepo.update).toHaveBeenLastCalledWith(
        'tournament-1',
        {
          bracketData: expect.objectContaining({
            'age-group-1': expect.objectContaining({ playoffRounds }),
          }),
        },
      );
    });

    it('should create recursive placement bracket tabs for all group positions', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [
          {
            id: 'age-group-1',
            format: 'GROUPS_PLUS_KNOCKOUT',
            groupsCount: 4,
            qualifyingTeamsPerGroup: 2,
            drawCompleted: true,
          },
        ],
        bracketData: {},
      });
      mockRegistrationsRepo.find.mockResolvedValue(
        Array.from({ length: 16 }, (_, index) => ({
          id: `reg-${index + 1}`,
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: `Team ${index + 1}` },
        })),
      );
      mockBracketGeneratorService.generateBracket.mockReturnValue({
        type: 'GROUPS_PLUS_KNOCKOUT',
        advancingTeamsPerGroup: 2,
        matches: [],
        playoffRounds: [],
      });
      mockGroupsRepo.find.mockResolvedValue(
        ['A', 'B', 'C', 'D'].map((groupLetter, groupIndex) => ({
          id: `group-${groupLetter}`,
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          groupLetter,
          teams: Array.from(
            { length: 4 },
            (_, teamIndex) => `reg-${groupIndex * 4 + teamIndex + 1}`,
          ),
        })),
      );
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.generateBracket(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      expect(result.placementBrackets.map((bracket: any) => bracket.label)).toEqual([
        '1-8',
        '9-16',
      ]);
      expect(result.placementBrackets[0].children.winners.label).toBe('1-4');
      expect(result.placementBrackets[0].children.losers.label).toBe('5-8');
      expect(result.placementBrackets[0].playoffRounds[0].matches[0]).toEqual(
        expect.objectContaining({
          team1SourceSlot: 'A1',
          team2SourceSlot: 'D2',
          nextMatchId: 'placement-1-4-r1-m1',
          loserNextMatchId: 'placement-5-8-r1-m1',
        }),
      );
    });

    it('should build placement ranges from qualifying teams per group without odd zero-match branches', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [
          {
            id: 'age-group-1',
            format: 'GROUPS_PLUS_KNOCKOUT',
            groupsCount: 2,
            teamsPerGroup: 5,
            qualifyingTeamsPerGroup: 2,
            drawCompleted: true,
          },
        ],
        bracketData: {},
      });
      mockRegistrationsRepo.find.mockResolvedValue(
        Array.from({ length: 10 }, (_, index) => ({
          id: `reg-${index + 1}`,
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          status: RegistrationStatus.APPROVED,
          club: { name: `Team ${index + 1}` },
        })),
      );
      mockBracketGeneratorService.generateBracket.mockReturnValue({
        type: 'GROUPS_PLUS_KNOCKOUT',
        advancingTeamsPerGroup: 2,
        matches: [],
        playoffRounds: [],
      });
      mockGroupsRepo.find.mockResolvedValue(
        ['A', 'B'].map((groupLetter, groupIndex) => ({
          id: `group-${groupLetter}`,
          tournamentId: 'tournament-1',
          ageGroupId: 'age-group-1',
          groupLetter,
          teams: Array.from(
            { length: 5 },
            (_, teamIndex) => `reg-${groupIndex * 5 + teamIndex + 1}`,
          ),
        })),
      );
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.generateBracket(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      const walk = (bracket: any): any[] => [
        bracket,
        ...(bracket.children?.winners ? walk(bracket.children.winners) : []),
        ...(bracket.children?.losers ? walk(bracket.children.losers) : []),
      ];
      const allPlacementNodes = result.placementBrackets.flatMap((bracket: any) =>
        walk(bracket),
      );

      expect(result.placementBrackets.map((bracket: any) => bracket.label)).toEqual([
        '1-4',
        '5-8',
        '9-10',
      ]);
      expect(
        allPlacementNodes.every(
          (bracket: any) => bracket.playoffRounds[0].matches.length > 0,
        ),
      ).toBe(true);
      expect(result.placementBrackets[0].children.winners.label).toBe('1-2');
      expect(result.placementBrackets[0].children.losers.label).toBe('3-4');
      expect(result.placementBrackets[2].children).toBeUndefined();
    });
  });

  describe('generateKnockoutBracket', () => {
    it('should create a provisional knockout shell before group matches are completed', async () => {
      const bracketData: any = {
        type: 'GROUPS_PLUS_KNOCKOUT',
        advancingTeamsPerGroup: 1,
        matches: [
          {
            id: 'grp_A_1',
            round: 1,
            matchNumber: 1,
            groupLetter: 'A',
            team1Id: 'reg-1',
            team1Name: 'Team 1',
            team2Id: 'reg-2',
            team2Name: 'Team 2',
            status: 'PENDING',
          },
          {
            id: 'grp_B_1',
            round: 1,
            matchNumber: 1,
            groupLetter: 'B',
            team1Id: 'reg-3',
            team1Name: 'Team 3',
            team2Id: 'reg-4',
            team2Name: 'Team 4',
            status: 'PENDING',
          },
        ],
      };
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
        ageGroups: [{ id: 'age-group-1', format: 'GROUPS_PLUS_KNOCKOUT' }],
        bracketData: { 'age-group-1': bracketData },
      });
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

      const result = await service.generateKnockoutBracket(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      expect(result.playoffRounds).toBe(playoffRounds);
      expect(mockBracketGeneratorService.seedTeamsIntoBracket).not.toHaveBeenCalled();
      expect(mockTournamentsRepo.update).toHaveBeenCalledWith('tournament-1', {
        bracketData: {
          'age-group-1': expect.objectContaining({ playoffRounds }),
        },
      });
    });

    it('should seed an existing knockout shell and preserve scheduled match details', async () => {
      const scheduledAt = new Date('2026-06-22T10:00:00.000Z');
      const bracketData = {
        type: 'GROUPS_PLUS_KNOCKOUT',
        advancingTeamsPerGroup: 1,
        matches: [
          {
            id: 'grp_A_1',
            round: 1,
            matchNumber: 1,
            groupLetter: 'A',
            team1Id: 'reg-1',
            team1Name: 'Team 1',
            team1Score: 2,
            team2Id: 'reg-2',
            team2Name: 'Team 2',
            team2Score: 0,
            status: 'COMPLETED',
          },
          {
            id: 'grp_B_1',
            round: 1,
            matchNumber: 1,
            groupLetter: 'B',
            team1Id: 'reg-3',
            team1Name: 'Team 3',
            team1Score: 3,
            team2Id: 'reg-4',
            team2Name: 'Team 4',
            team2Score: 1,
            status: 'COMPLETED',
          },
        ],
        playoffRounds: [
          {
            roundNumber: 1,
            roundName: 'Final',
            matches: [
              {
                id: 'ko-1',
                round: 1,
                matchNumber: 1,
                status: 'PENDING',
                scheduledAt,
                fieldName: 'Pitch 2',
              },
            ],
          },
        ],
      };
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [{ id: 'age-group-1', format: 'GROUPS_PLUS_KNOCKOUT' }],
        bracketData: { 'age-group-1': bracketData },
      });
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
      mockBracketGeneratorService.calculateGroupStandings
        .mockReturnValueOnce([{ teamId: 'reg-1', position: 1 }])
        .mockReturnValueOnce([{ teamId: 'reg-3', position: 1 }]);
      mockBracketGeneratorService.seedTeamsIntoBracket.mockImplementation(
        (_standings, _advancing, data) => {
          data.playoffRounds[0].matches[0].team1Id = 'reg-1';
          data.playoffRounds[0].matches[0].team2Id = 'reg-3';
          return data;
        },
      );
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.generateKnockoutBracket(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      expect(mockGroupsRepo.find).toHaveBeenCalledWith({
        where: { tournamentId: 'tournament-1', ageGroupId: 'age-group-1' },
        order: { groupLetter: 'ASC' },
      });
      expect(result.playoffRounds[0].matches[0]).toEqual(
        expect.objectContaining({
          team1Id: 'reg-1',
          team1Name: 'Team 1',
          team2Id: 'reg-3',
          team2Name: 'Team 3',
          scheduledAt,
          fieldName: 'Pitch 2',
        }),
      );
      expect(mockTournamentsRepo.update).toHaveBeenCalledWith('tournament-1', {
        bracketData: { 'age-group-1': result },
      });
    });

    it('should seed placement brackets from completed group standings', async () => {
      const bracketData = {
        type: 'GROUPS_PLUS_KNOCKOUT',
        advancingTeamsPerGroup: 1,
        matches: [
          {
            id: 'grp_A_1',
            round: 1,
            matchNumber: 1,
            groupLetter: 'A',
            team1Id: 'reg-1',
            team1Name: 'Team 1',
            team1Score: 2,
            team2Id: 'reg-2',
            team2Name: 'Team 2',
            team2Score: 0,
            status: 'COMPLETED',
          },
          {
            id: 'grp_B_1',
            round: 1,
            matchNumber: 1,
            groupLetter: 'B',
            team1Id: 'reg-3',
            team1Name: 'Team 3',
            team1Score: 3,
            team2Id: 'reg-4',
            team2Name: 'Team 4',
            team2Score: 1,
            status: 'COMPLETED',
          },
        ],
        playoffRounds: [
          {
            roundNumber: 1,
            roundName: 'Final',
            matches: [
              { id: 'ko-1', round: 1, matchNumber: 1, status: 'PENDING' },
            ],
          },
        ],
      };
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        ageGroups: [{ id: 'age-group-1', format: 'GROUPS_PLUS_KNOCKOUT' }],
        bracketData: { 'age-group-1': bracketData },
      });
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
      mockBracketGeneratorService.calculateGroupStandings.mockImplementation(
        (teams: string[]) =>
          teams.map((teamId, index) => ({ teamId, position: index + 1 })),
      );
      mockBracketGeneratorService.seedTeamsIntoBracket.mockImplementation(
        (_standings, _advancing, data) => data,
      );
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.generateKnockoutBracket(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'age-group-1',
      );

      expect(result.placementBrackets[0].playoffRounds[0].matches[0]).toEqual(
        expect.objectContaining({
          team1SourceSlot: 'A1',
          team1Id: 'reg-1',
          team1Name: 'Team 1',
          team2SourceSlot: 'B1',
          team2Id: 'reg-3',
          team2Name: 'Team 3',
        }),
      );
      expect(result.placementBrackets[1].playoffRounds[0].matches[0]).toEqual(
        expect.objectContaining({
          team1SourceSlot: 'A2',
          team1Id: 'reg-2',
          team2SourceSlot: 'B2',
          team2Id: 'reg-4',
        }),
      );
    });
  });

  describe('updateMatchScore', () => {
    it('should propagate placement winners and losers into the next nested tabs', async () => {
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
                    team1Id: 'reg-1',
                    team1Name: 'Team 1',
                    team2Id: 'reg-4',
                    team2Name: 'Team 4',
                    nextMatchId: 'placement-1-2-r1-m1',
                    loserNextMatchId: 'placement-3-4-r1-m1',
                  },
                ],
              },
            ],
            children: {
              winners: {
                key: 'placement-1-2',
                label: '1-2',
                rangeStart: 1,
                rangeEnd: 2,
                playoffRounds: [
                  {
                    roundNumber: 1,
                    roundName: '1-2',
                    matches: [
                      {
                        id: 'placement-1-2-r1-m1',
                        round: 1,
                        matchNumber: 1,
                        status: 'PENDING',
                      },
                    ],
                  },
                ],
              },
              losers: {
                key: 'placement-3-4',
                label: '3-4',
                rangeStart: 3,
                rangeEnd: 4,
                playoffRounds: [
                  {
                    roundNumber: 1,
                    roundName: '3-4',
                    matches: [
                      {
                        id: 'placement-3-4-r1-m1',
                        round: 1,
                        matchNumber: 1,
                        status: 'PENDING',
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      };
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketData: { 'age-group-1': bracketData },
      });
      mockTournamentsRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateMatchScore(
        'tournament-1',
        'placement-1-4-r1-m1',
        'organizer-1',
        UserRole.ORGANIZER,
        { team1Score: 2, team2Score: 1 },
        'age-group-1',
      );

      expect(result.bracketUpdated).toBe(true);
      expect(
        bracketData.placementBrackets[0].children.winners.playoffRounds[0]
          .matches[0].team1Id,
      ).toBe('reg-1');
      expect(
        bracketData.placementBrackets[0].children.losers.playoffRounds[0]
          .matches[0].team1Id,
      ).toBe('reg-4');
      expect(mockTournamentsRepo.update).toHaveBeenCalledWith('tournament-1', {
        bracketData: { 'age-group-1': bracketData },
      });
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
