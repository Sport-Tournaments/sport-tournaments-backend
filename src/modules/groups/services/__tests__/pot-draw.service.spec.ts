import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PotDrawService } from '../pot-draw.service';
import { TournamentPot } from '../../entities/tournament-pot.entity';
import { Group } from '../../entities/group.entity';
import { Tournament } from '../../../tournaments/entities/tournament.entity';
import { Registration } from '../../../registrations/entities/registration.entity';
import { TournamentAgeGroup } from '../../../tournaments/entities/tournament-age-group.entity';
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
      createQueryBuilder: jest.fn(),
    };

    // Helper: createQueryBuilder delegates getMany to find mock
    mockPotRepository.createQueryBuilder.mockImplementation(() => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
        getMany: jest.fn().mockImplementation(() => mockPotRepository.find()),
      };
      return qb;
    });

    const mockTournamentRepository = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const mockRegistrationRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const mockAgeGroupRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: getRepositoryToken(TournamentAgeGroup),
          useValue: mockAgeGroupRepository,
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
      // pot 4 has no data → not included in the map
      expect(result.get(4)).toBeUndefined();
    });
  });

  describe('Execute Pot-Based Draw', () => {
    it('should execute draw and create balanced groups (16 teams, 4 pots of 4)', async () => {
      // numPots = numberOfGroups = 4; teamsPerPot = 16/4 = 4 → 4 output groups
      // Circular algorithm: each group gets 1 team from each of the 4 pots
      const tournamentWithRegistrations = {
        ...mockTournament,
        registrations: Array.from({ length: 16 }, (_, i) => ({
          id: `reg-${i}`,
          status: RegistrationStatus.APPROVED,
        })),
      };

      // 4 pots, 4 teams each
      const allPots: any[] = [
        ...Array.from({ length: 4 }, (_, i) => ({ registrationId: `reg-${i}`, potNumber: 1 })),
        ...Array.from({ length: 4 }, (_, i) => ({ registrationId: `reg-${i + 4}`, potNumber: 2 })),
        ...Array.from({ length: 4 }, (_, i) => ({ registrationId: `reg-${i + 8}`, potNumber: 3 })),
        ...Array.from({ length: 4 }, (_, i) => ({ registrationId: `reg-${i + 12}`, potNumber: 4 })),
      ];

      tournamentRepository.findOne.mockResolvedValue(tournamentWithRegistrations);
      potRepository.find.mockResolvedValue(allPots);

      const dto = { numberOfGroups: 4 };

      const result = await service.executePotBasedDraw(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      // numPots = numGroups = 4; circular distribution: each group gets 1 team from each pot
      expect(result).toHaveLength(4);
      expect(groupRepository.save).toHaveBeenCalledTimes(4);
      // Circular: Pot p → groups (p-1+k)%4 for k=0..3
      // Group A (idx=0): Pot1[k=0]=reg-0, Pot2[k=3]=reg-7, Pot3[k=2]=reg-10, Pot4[k=1]=reg-13
      expect(result[0].teams).toEqual(['reg-0', 'reg-7', 'reg-10', 'reg-13']);
      // Group B (idx=1): Pot1[k=1]=reg-1, Pot2[k=0]=reg-4, Pot3[k=3]=reg-11, Pot4[k=2]=reg-14
      expect(result[1].teams).toEqual(['reg-1', 'reg-4', 'reg-11', 'reg-14']);
      expect(tournamentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ drawCompleted: true }),
      );
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

    it('should reject if not all teams are assigned to pots', async () => {
      const tournamentWith6Teams = {
        ...mockTournament,
        registrations: Array.from({ length: 6 }, (_, i) => ({
          id: `reg-${i}`,
          status: RegistrationStatus.APPROVED,
        })),
      };

      tournamentRepository.findOne.mockResolvedValue(tournamentWith6Teams);
      // Only 4 of 6 teams assigned to pots
      potRepository.find.mockResolvedValue([
        { potNumber: 1, registrationId: 'reg-0' },
        { potNumber: 1, registrationId: 'reg-1' },
        { potNumber: 2, registrationId: 'reg-2' },
        { potNumber: 2, registrationId: 'reg-3' },
      ]);

      const dto = { numberOfGroups: 2 };

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

    it('should validate without expectedTeamsPerPot (no count constraint)', async () => {
      const mixedPots = [
        { potNumber: 1, registrationId: 'reg-1' },
        { potNumber: 1, registrationId: 'reg-2' },
        { potNumber: 2, registrationId: 'reg-3' },
        { potNumber: 3, registrationId: 'reg-4' },
        { potNumber: 3, registrationId: 'reg-5' },
        { potNumber: 3, registrationId: 'reg-6' },
      ];

      potRepository.find.mockResolvedValue(mixedPots);

      const result = await service.validatePotDistribution(mockTournamentId);

      expect(result.valid).toBe(true);
      expect(result.message).toBe('Total teams assigned: 6');
      expect(result.potCounts.get(1)).toBe(2);
      expect(result.potCounts.get(2)).toBe(1);
      expect(result.potCounts.get(3)).toBe(3);
      // pot 4 has no assignments → not present in the map
      expect(result.potCounts.get(4)).toBeUndefined();
    });

    it('should return valid for empty pots', async () => {
      potRepository.find.mockResolvedValue([]);

      const result = await service.validatePotDistribution(mockTournamentId);

      expect(result.valid).toBe(true);
      expect(result.message).toBe('Total teams assigned: 0');
    });
  });

  describe('Execute Pot-Based Draw - Snake Draft Balance', () => {
    it('should distribute from each pot across groups (6 teams, 3 pots of 2 → 3 output groups)', async () => {
      // numGroups=3, numPots=3 (=numGroups), teamsPerPot=6/3=2 → 3 output groups of 2 teams each
      const tournamentWith6 = {
        ...mockTournament,
        registrations: Array.from({ length: 6 }, (_, i) => ({
          id: `reg-${i}`,
          status: RegistrationStatus.APPROVED,
        })),
      };

      tournamentRepository.findOne.mockResolvedValue(tournamentWith6);
      potRepository.find.mockResolvedValue([
        { potNumber: 1, registrationId: 'reg-0' },
        { potNumber: 1, registrationId: 'reg-1' },
        { potNumber: 2, registrationId: 'reg-2' },
        { potNumber: 2, registrationId: 'reg-3' },
        { potNumber: 3, registrationId: 'reg-4' },
        { potNumber: 3, registrationId: 'reg-5' },
      ]);

      const dto = { numberOfGroups: 3 }; // numPots=numGroups=3, 3 pots of 2 teams → 3 output groups of 2 teams
      const result = await service.executePotBasedDraw(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      expect(result).toHaveLength(3);
      expect(groupRepository.save).toHaveBeenCalledTimes(3);

      // Group i gets team at position i from each pot
      const group1 = result[0];
      const group2 = result[1];
      const group3 = result[2];
      expect(group1.teams).toHaveLength(2);
      expect(group2.teams).toHaveLength(2);
      expect(group3.teams).toHaveLength(2);
      expect(group1.groupLetter).toBe('A');
      expect(group2.groupLetter).toBe('B');
      expect(group3.groupLetter).toBe('C');
    });

    it('should handle uneven team counts (5 teams, numGroups=3 → 3 groups, partial pot)', async () => {
      // numGroups=3, numPots=3 (=numGroups), 5 teams: teamsPerPot=floor(5/3)=1, remainder=2
      // Pots 1 & 2 (i<=remainder=2): teamsPerPot+1 = 2 teams each
      // Pot 3 (i>remainder): teamsPerPot = 1 team
      const tournamentWith5 = {
        ...mockTournament,
        registrations: Array.from({ length: 5 }, (_, i) => ({
          id: `reg-${i}`,
          status: RegistrationStatus.APPROVED,
        })),
      };

      tournamentRepository.findOne.mockResolvedValue(tournamentWith5);
      potRepository.find.mockResolvedValue([
        { potNumber: 1, registrationId: 'reg-0' },
        { potNumber: 1, registrationId: 'reg-1' }, // pot 1: 2 teams (teamsPerPot+1)
        { potNumber: 2, registrationId: 'reg-2' },
        { potNumber: 2, registrationId: 'reg-3' }, // pot 2: 2 teams (teamsPerPot+1)
        { potNumber: 3, registrationId: 'reg-4' }, // pot 3: 1 team (teamsPerPot)
      ]);

      const dto = { numberOfGroups: 3 };
      const result = await service.executePotBasedDraw(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      // 3 output groups, total 5 teams
      expect(result).toHaveLength(3);
      const totalTeams = result.reduce((sum: number, g: any) => sum + g.teams.length, 0);
      expect(totalTeams).toBe(5);
    });

    it('should reject numberOfGroups > totalTeams', async () => {
      const smallTournament = {
        ...mockTournament,
        registrations: [
          { id: 'reg-0', status: RegistrationStatus.APPROVED },
          { id: 'reg-1', status: RegistrationStatus.APPROVED },
        ],
      };

      tournamentRepository.findOne.mockResolvedValue(smallTournament);

      const dto = { numberOfGroups: 5 };

      await expect(
        service.executePotBasedDraw(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject numberOfGroups < 1', async () => {
      const tournament = {
        ...mockTournament,
        registrations: [
          { id: 'reg-0', status: RegistrationStatus.APPROVED },
        ],
      };

      tournamentRepository.findOne.mockResolvedValue(tournament);

      const dto = { numberOfGroups: 0 };

      await expect(
        service.executePotBasedDraw(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should only count APPROVED registrations (ignore withdrawn/pending)', async () => {
      // 4 approved teams, numPots=2 → teamsPerPot=2 → 2 output groups of 2 teams each
      const mixedTournament = {
        ...mockTournament,
        registrations: [
          { id: 'reg-0', status: RegistrationStatus.APPROVED },
          { id: 'reg-1', status: RegistrationStatus.APPROVED },
          { id: 'reg-2', status: RegistrationStatus.WITHDRAWN },
          { id: 'reg-3', status: RegistrationStatus.PENDING },
          { id: 'reg-4', status: RegistrationStatus.APPROVED },
          { id: 'reg-5', status: RegistrationStatus.APPROVED },
        ],
      };

      tournamentRepository.findOne.mockResolvedValue(mixedTournament);
      // 2 pots of 2 approved teams each (total approved = 4)
      potRepository.find.mockResolvedValue([
        { potNumber: 1, registrationId: 'reg-0' },
        { potNumber: 1, registrationId: 'reg-1' },
        { potNumber: 2, registrationId: 'reg-4' },
        { potNumber: 2, registrationId: 'reg-5' },
      ]);

      const dto = { numberOfGroups: 2 };
      const result = await service.executePotBasedDraw(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      // teamsPerPot=2 → 2 output groups, 2 teams each
      expect(result).toHaveLength(2);
      const totalTeams = result.reduce((sum: number, g: any) => sum + g.teams.length, 0);
      expect(totalTeams).toBe(4); // Only 4 approved
    });

    it('should set drawCompleted to true after successful draw', async () => {
      // numGroups=2, numPots=2 (=numGroups), 2 teams: teamsPerPot=1 → 2 pots of 1 team → 2 output groups of 1 team each
      const tournament = {
        ...mockTournament,
        registrations: [
          { id: 'reg-0', status: RegistrationStatus.APPROVED },
          { id: 'reg-1', status: RegistrationStatus.APPROVED },
        ],
      };

      tournamentRepository.findOne.mockResolvedValue(tournament);
      potRepository.find.mockResolvedValue([
        { potNumber: 1, registrationId: 'reg-0' },
        { potNumber: 2, registrationId: 'reg-1' },
      ]);

      const dto = { numberOfGroups: 2 }; // 2 pots of 1 team → 2 output groups of 1 team each
      await service.executePotBasedDraw(
        mockTournamentId,
        dto,
        mockOrganizerId,
        UserRole.ORGANIZER,
      );

      expect(tournamentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ drawCompleted: true }),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle re-assigning team to different pot (update)', async () => {
      const existingPot = {
        id: 'pot-1',
        tournamentId: mockTournamentId,
        registrationId: 'reg-1',
        potNumber: 1,
      };

      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      registrationRepository.findOne.mockResolvedValue(mockRegistration);
      potRepository.findOne.mockResolvedValue(existingPot);

      const dto = { registrationId: 'registration-1', potNumber: 4 };
      await service.assignTeamToPot(mockTournamentId, dto, mockOrganizerId, UserRole.ORGANIZER);

      expect(potRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ potNumber: 4 }),
      );
    });

    it('should reject clear pots for non-existent tournament', async () => {
      tournamentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.clearPotAssignments('non-existent-id', mockOrganizerId, UserRole.ORGANIZER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow admin to clear pots for any tournament', async () => {
      tournamentRepository.findOne.mockResolvedValue(mockTournament);
      potRepository.delete.mockResolvedValue({ affected: 5 });

      // Different user but admin role
      await service.clearPotAssignments(mockTournamentId, mockUserId, UserRole.ADMIN);

      expect(potRepository.delete).toHaveBeenCalledWith({ tournamentId: mockTournamentId });
    });

    it('should get pot assignments with empty pots', async () => {
      potRepository.find.mockResolvedValue([]);

      const result = await service.getPotAssignments(mockTournamentId);

      // Empty assignments → map has only pot 1 (minimum)
      expect(result.get(1)).toHaveLength(0);
      // Pots 2-4 don't exist in the map
      expect(result.get(2)).toBeUndefined();
      expect(result.get(3)).toBeUndefined();
      expect(result.get(4)).toBeUndefined();
    });
  });
});
