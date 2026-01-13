import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PotDrawService } from '../pot-draw.service';
import { TournamentPot } from '../../entities/tournament-pot.entity';
import { Group } from '../../entities/group.entity';
import { Tournament } from '../../../tournaments/entities/tournament.entity';
import { Registration } from '../../../registrations/entities/registration.entity';
import { UserRole, RegistrationStatus } from '../../../../common/enums';

/**
 * Unit Test Suite: Pot Draw Service (Issue #34)
 * Tests the pot-based group draw system with authorization checks
 */
describe('PotDrawService (Issue #34)', () => {
  let service: PotDrawService;
  let potRepository: any;
  let tournamentRepository: any;
  let registrationRepository: any;
  let groupRepository: any;

  const mockOrganizerId = 'organizer-id-123';
  const mockUserId = 'user-id-456';
  const mockTournamentId = 'tournament-id-789';

  const mockTournament = {
    id: mockTournamentId,
    organizerId: mockOrganizerId,
    drawCompleted: false,
    registrations: [],
  };

  const mockRegistration = {
    id: 'registration-1',
    tournamentId: mockTournamentId,
    status: RegistrationStatus.APPROVED,
    club: { name: 'Test Club' },
  };

  beforeEach(async () => {
    const mockPotRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: 'pot-id' })),
      delete: jest.fn(),
    };

    const mockTournamentRepository = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const mockRegistrationRepository = {
      findOne: jest.fn(),
    };

    const mockGroupRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: 'group-id' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PotDrawService,
        {
          provide: getRepositoryToken(TournamentPot),
          useValue: mockPotRepository,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentRepository,
        },
        {
          provide: getRepositoryToken(Registration),
          useValue: mockRegistrationRepository,
        },
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupRepository,
        },
      ],
    }).compile();

    service = module.get<PotDrawService>(PotDrawService);
    potRepository = module.get(getRepositoryToken(TournamentPot));
    tournamentRepository = module.get(getRepositoryToken(Tournament));
    registrationRepository = module.get(getRepositoryToken(Registration));
    groupRepository = module.get(getRepositoryToken(Group));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization Checks', () => {
    it('should allow organizer to assign team to pot', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      registrationRepository.findOne.mockResolvedValue(mockRegistration);
      potRepository.findOne.mockResolvedValue(null);

      const dto = { registrationId: 'registration-1', potNumber: 1 };

      const result = await service.assignTeamToPot(
        mockTournamentId,
        dto,
        mockOrganizerId, // Same as tournament organizer
        UserRole.ORGANIZER,
      );

      expect(result).toBeDefined();
      expect(potRepository.save).toHaveBeenCalled();
    });

    it('should allow admin to assign team to pot', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      registrationRepository.findOne.mockResolvedValue(mockRegistration);
      potRepository.findOne.mockResolvedValue(null);

      const dto = { registrationId: 'registration-1', potNumber: 1 };

      const result = await service.assignTeamToPot(
        mockTournamentId,
        dto,
        mockUserId, // Different user
        UserRole.ADMIN, // But admin role
      );

      expect(result).toBeDefined();
      expect(potRepository.save).toHaveBeenCalled();
    });

    it('should reject non-organizer from assigning team to pot', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);

      const dto = { registrationId: 'registration-1', potNumber: 1 };

      await expect(
        service.assignTeamToPot(
          mockTournamentId,
          dto,
          mockUserId, // Different user ID
          UserRole.PARTICIPANT, // Not organizer or admin
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if tournament not found', async () => {
      tournamentRepository.findOne.mockResolvedValue(null);

      const dto = { registrationId: 'registration-1', potNumber: 1 };

      await expect(
        service.assignTeamToPot(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Team Assignment to Pots', () => {
    it('should assign team to pot successfully', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      registrationRepository.findOne.mockResolvedValue(mockRegistration);
      potRepository.findOne.mockResolvedValue(null); // No existing assignment

      const dto = { registrationId: 'registration-1', potNumber: 2 };

      const result = await service.assignTeamToPot(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      expect(potRepository.create).toHaveBeenCalledWith({
        tournamentId: mockTournamentId,
        registrationId: dto.registrationId,
        potNumber: dto.potNumber,
      });
      expect(potRepository.save).toHaveBeenCalled();
    });

    it('should update existing pot assignment', async () => {
      const existingPot = {
        id: 'existing-pot-id',
        tournamentId: mockTournamentId,
        registrationId: 'registration-1',
        potNumber: 1,
      };

      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      registrationRepository.findOne.mockResolvedValue(mockRegistration);
      potRepository.findOne.mockResolvedValue(existingPot);

      const dto = { registrationId: 'registration-1', potNumber: 3 };

      const result = await service.assignTeamToPot(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      expect(potRepository.save).toHaveBeenCalledWith({
        ...existingPot,
        potNumber: 3,
      });
    });

    it('should reject if registration not found', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      registrationRepository.findOne.mockResolvedValue(null);

      const dto = { registrationId: 'non-existent-registration', potNumber: 1 };

      await expect(
        service.assignTeamToPot(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject non-approved registrations', async () => {
      const pendingRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.PENDING,
      };

      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      registrationRepository.findOne.mockResolvedValue(pendingRegistration);

      const dto = { registrationId: 'registration-1', potNumber: 1 };

      await expect(
        service.assignTeamToPot(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Bulk Assignment', () => {
    it('should assign multiple teams to pots', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      registrationRepository.findOne.mockResolvedValue(mockRegistration);
      potRepository.findOne.mockResolvedValue(null);

      const dto = {
        assignments: [
          { registrationId: 'reg-1', potNumber: 1 },
          { registrationId: 'reg-2', potNumber: 2 },
          { registrationId: 'reg-3', potNumber: 3 },
        ],
      };

      const result = await service.assignTeamsToPotsBulk(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      expect(result).toHaveLength(3);
      expect(potRepository.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('Get Pot Assignments', () => {
    it('should return pot assignments grouped by pot number', async () => {
      const mockPots = [
        { potNumber: 1, registrationId: 'reg-1', registration: { club: { name: 'Club A' } } },
        { potNumber: 1, registrationId: 'reg-2', registration: { club: { name: 'Club B' } } },
        { potNumber: 2, registrationId: 'reg-3', registration: { club: { name: 'Club C' } } },
        { potNumber: 3, registrationId: 'reg-4', registration: { club: { name: 'Club D' } } },
      ];

      potRepository.find.mockResolvedValue(mockPots);

      const result = await service.getPotAssignments(mockTournamentId);

      expect(result.get(1)).toHaveLength(2);
      expect(result.get(2)).toHaveLength(1);
      expect(result.get(3)).toHaveLength(1);
      expect(result.get(4)).toHaveLength(0);
    });
  });

  describe('Execute Pot-Based Draw', () => {
    it('should execute draw and create balanced groups', async () => {
      // Setup: 16 teams, 4 pots of 4 teams each
      const tournamentWithRegistrations = {
        ...mockTournament,
        registrations: Array.from({ length: 16 }, (_, i) => ({
          id: `reg-${i}`,
          status: RegistrationStatus.APPROVED,
        })),
      };

      const mockPotAssignments = new Map([
        [1, Array.from({ length: 4 }, (_, i) => ({ registrationId: `reg-${i}`, potNumber: 1 }))],
        [2, Array.from({ length: 4 }, (_, i) => ({ registrationId: `reg-${i + 4}`, potNumber: 2 }))],
        [3, Array.from({ length: 4 }, (_, i) => ({ registrationId: `reg-${i + 8}`, potNumber: 3 }))],
        [4, Array.from({ length: 4 }, (_, i) => ({ registrationId: `reg-${i + 12}`, potNumber: 4 }))],
      ]);

      tournamentRepository.findOne.mockResolvedValue(tournamentWithRegistrations);
      potRepository.find.mockImplementation(async () => {
        const pots = [];
        for (const [potNum, teams] of mockPotAssignments.entries()) {
          pots.push(...teams.map(t => ({ ...t, potNumber: potNum })));
        }
        return pots;
      });

      const dto = { numberOfGroups: 4 };

      const result = await service.executePotBasedDraw(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      expect(result).toHaveLength(4); // 4 groups created
      expect(groupRepository.save).toHaveBeenCalledTimes(4);
      expect(tournamentRepository.save).toHaveBeenCalledWith({
        ...tournamentWithRegistrations,
        drawCompleted: true,
      });
    });

    it('should reject if draw already completed', async () => {
      const completedTournament = {
        ...mockTournament,
        drawCompleted: true,
      };

      tournamentRepository.findOne.mockResolvedValue(completedTournament);

      const dto = { numberOfGroups: 4 };

      await expect(
        service.executePotBasedDraw(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if no teams registered', async () => {
      const emptyTournament = {
        ...mockTournament,
        registrations: [],
      };

      tournamentRepository.findOne.mockResolvedValue(emptyTournament);

      const dto = { numberOfGroups: 4 };

      await expect(
        service.executePotBasedDraw(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if teams not divisible by groups', async () => {
      const oddTournament = {
        ...mockTournament,
        registrations: Array.from({ length: 15 }, (_, i) => ({
          id: `reg-${i}`,
          status: RegistrationStatus.APPROVED,
        })),
      };

      tournamentRepository.findOne.mockResolvedValue(oddTournament);

      const dto = { numberOfGroups: 4 }; // 15 teams / 4 groups = not divisible

      await expect(
        service.executePotBasedDraw(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Clear Pot Assignments', () => {
    it('should clear all pot assignments', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      potRepository.delete.mockResolvedValue({ affected: 10 });

      await service.clearPotAssignments(mockTournamentId, mockOrganizerId, UserRole.ORGANIZER);

      expect(potRepository.delete).toHaveBeenCalledWith({ tournamentId: mockTournamentId });
    });

    it('should reject non-organizer from clearing pots', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.clearPotAssignments(mockTournamentId, mockUserId, UserRole.PARTICIPANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Validate Pot Distribution', () => {
    it('should validate even pot distribution', async () => {
      const evenPots = [
        { potNumber: 1, registrationId: 'reg-1' },
        { potNumber: 1, registrationId: 'reg-2' },
        { potNumber: 2, registrationId: 'reg-3' },
        { potNumber: 2, registrationId: 'reg-4' },
      ];

      potRepository.find.mockResolvedValue(evenPots);

      const result = await service.validatePotDistribution(mockTournamentId, 2);

      expect(result.valid).toBe(true);
      expect(result.potCounts.get(1)).toBe(2);
      expect(result.potCounts.get(2)).toBe(2);
    });

    it('should detect uneven pot distribution', async () => {
      const unevenPots = [
        { potNumber: 1, registrationId: 'reg-1' },
        { potNumber: 1, registrationId: 'reg-2' },
        { potNumber: 1, registrationId: 'reg-3' }, // 3 teams in pot 1
        { potNumber: 2, registrationId: 'reg-4' }, // 1 team in pot 2
      ];

      potRepository.find.mockResolvedValue(unevenPots);

      const result = await service.validatePotDistribution(mockTournamentId, 2);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Uneven pot distribution');
    });
  });
});
