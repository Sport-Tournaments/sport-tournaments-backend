import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupsService } from './groups.service';
import { Group } from './entities/group.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
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

  const mockTournamentsRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockRegistrationsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
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
          provide: getRepositoryToken(Registration),
          useValue: mockRegistrationsRepo,
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
});
