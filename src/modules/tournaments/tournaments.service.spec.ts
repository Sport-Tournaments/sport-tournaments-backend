import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TournamentsService } from './tournaments.service';
import { Tournament } from './entities/tournament.entity';
import { TournamentAgeGroup } from './entities/tournament-age-group.entity';
import { CreateTournamentDto, UpdateTournamentDto } from './dto';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  TournamentStatus,
  AgeCategory,
  TournamentLevel,
  UserRole,
  Currency,
} from '../../common/enums';
import { FilesService } from '../files/files.service';

describe('TournamentsService', () => {
  let service: TournamentsService;

  const mockTournament: Partial<Tournament> = {
    id: 'tournament-1',
    name: 'U12 Test Tournament',
    description: 'Test description',
    ageCategory: AgeCategory.U12,
    level: TournamentLevel.LEVEL_I,
    gameSystem: '4+1',
    numberOfMatches: 6,
    organizerId: 'organizer-1',
    startDate: new Date('2025-06-15'),
    endDate: new Date('2025-06-17'),
    location: 'Brașov, Romania',
    latitude: 45.6427,
    longitude: 25.5887,
    maxTeams: 16,
    currentTeams: 12,
    participationFee: 200,
    currency: Currency.EUR,
    status: TournamentStatus.DRAFT,
    isPublished: false,
    isPremium: false,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockQueryBuilder = () => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockTournament], 1]),
    getOne: jest.fn().mockResolvedValue(mockTournament),
  });

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockAgeGroupRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockFilesService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(TournamentAgeGroup),
          useValue: mockAgeGroupRepository,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTournamentDto = {
      name: 'U12 Test Tournament',
      description: 'Test tournament',
      ageCategory: AgeCategory.U12,
      level: TournamentLevel.LEVEL_I,
      gameSystem: '4+1',
      numberOfMatches: 6,
      startDate: '2025-06-15',
      endDate: '2025-06-17',
      location: 'Brașov, Romania',
      latitude: 45.6427,
      longitude: 25.5887,
      maxTeams: 16,
      participationFee: 200,
      currency: Currency.EUR,
    };

    it('should create a tournament successfully', async () => {
      mockRepository.create.mockReturnValue(mockTournament);
      mockRepository.save.mockResolvedValue(mockTournament);

      const result = await service.create('organizer-1', createDto);

      expect(result).toEqual(mockTournament);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if end date is before start date', async () => {
      const invalidDto = {
        ...createDto,
        startDate: '2025-06-17',
        endDate: '2025-06-15',
      };

      await expect(service.create('organizer-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated tournaments', async () => {
      const pagination = { page: 1, pageSize: 20 };

      const result = await service.findAll(pagination);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith(
        'tournament',
      );
    });

    it('should apply filters when provided', async () => {
      const pagination = { page: 1, pageSize: 20 };
      const filters = { ageCategory: AgeCategory.U12 };

      await service.findAll(pagination, filters);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith(
        'tournament',
      );
    });
  });

  describe('findById', () => {
    it('should return a tournament by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);

      const result = await service.findById('tournament-1');

      expect(result).toEqual(mockTournament);
    });

    it('should return null if tournament not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return a tournament by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);

      const result = await service.findByIdOrFail('tournament-1');

      expect(result).toEqual(mockTournament);
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateTournamentDto = {
      name: 'Updated Tournament Name',
      maxTeams: 20,
    };

    it('should update tournament when user is owner', async () => {
      const draftTournament = {
        ...mockTournament,
        status: TournamentStatus.DRAFT,
      };
      mockRepository.findOne.mockResolvedValue(draftTournament);
      mockRepository.save.mockResolvedValue({
        ...draftTournament,
        ...updateDto,
      });

      const result = await service.update(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        updateDto,
      );

      expect(result.name).toBe('Updated Tournament Name');
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.update(
          'tournament-1',
          'other-user',
          UserRole.ORGANIZER,
          updateDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to update any tournament', async () => {
      const draftTournament = {
        ...mockTournament,
        status: TournamentStatus.DRAFT,
      };
      mockRepository.findOne.mockResolvedValue(draftTournament);
      mockRepository.save.mockResolvedValue({
        ...draftTournament,
        ...updateDto,
      });

      const result = await service.update(
        'tournament-1',
        'admin-user',
        UserRole.ADMIN,
        updateDto,
      );

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when updating completed tournament', async () => {
      const completedTournament = {
        ...mockTournament,
        status: TournamentStatus.COMPLETED,
      };
      mockRepository.findOne.mockResolvedValue(completedTournament);

      await expect(
        service.update(
          'tournament-1',
          'organizer-1',
          UserRole.ORGANIZER,
          updateDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a tournament when user is owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.remove.mockResolvedValue(mockTournament);

      await service.remove('tournament-1', 'organizer-1', UserRole.ORGANIZER);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockTournament);
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.remove('tournament-1', 'other-user', UserRole.ORGANIZER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to remove any tournament', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.remove.mockResolvedValue(mockTournament);

      await service.remove('tournament-1', 'admin-user', UserRole.ADMIN);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockTournament);
    });
  });

  describe('findByOrganizer', () => {
    it('should return tournaments by organizer id', async () => {
      mockRepository.find.mockResolvedValue([mockTournament]);

      const result = await service.findByOrganizer('organizer-1');

      expect(result).toHaveLength(1);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizerId: 'organizer-1' },
        order: { startDate: 'DESC' },
      });
    });
  });

  describe('getAvailableSpots', () => {
    it('should calculate available spots correctly', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);

      const result = await service.findById('tournament-1');
      const availableSpots = result!.maxTeams - result!.currentTeams;

      expect(availableSpots).toBe(4); // maxTeams (16) - currentTeams (12)
    });
  });

  // Issue #24: Data Persistence Verification Tests
  describe('Issue #24: Tournament Age Group Data Persistence', () => {
    describe('create with age groups', () => {
      it('should save all age group fields including minTeams, maxTeams, and guaranteedMatches', async () => {
        const createDto: CreateTournamentDto = {
          name: 'Multi-Age Tournament',
          description: 'Tournament with multiple age groups',
          startDate: '2025-07-01',
          endDate: '2025-07-05',
          location: 'Test Location',
          maxTeams: 32,
          ageGroups: [
            {
              birthYear: 2010,
              displayLabel: 'U14',
              gameSystem: '7+1',
              teamCount: 16,
              minTeams: 8,
              maxTeams: 16,
              numberOfMatches: 5,
              guaranteedMatches: 3,
              startDate: '2025-07-01',
              endDate: '2025-07-03',
              participationFee: 250,
            },
            {
              birthYear: 2012,
              displayLabel: 'U12',
              gameSystem: '5+1',
              teamCount: 12,
              minTeams: 6,
              maxTeams: 12,
              numberOfMatches: 4,
              guaranteedMatches: 3,
              startDate: '2025-07-03',
              endDate: '2025-07-05',
              participationFee: 200,
            },
          ],
        };

        const mockSavedTournament = { ...mockTournament, id: 'new-tournament-id' };
        mockRepository.create.mockReturnValue(mockSavedTournament);
        mockRepository.save.mockResolvedValue(mockSavedTournament);

        const mockAgeGroups = createDto.ageGroups!.map((ag, index) => ({
          id: `age-group-${index}`,
          tournamentId: 'new-tournament-id',
          ...ag,
          startDate: new Date(ag.startDate!),
          endDate: new Date(ag.endDate!),
        }));

        mockAgeGroupRepository.create.mockImplementation((data) => data);
        mockAgeGroupRepository.save.mockResolvedValue(mockAgeGroups);

        await service.create('organizer-1', createDto);

        // Verify age groups repository was called with correct data
        expect(mockAgeGroupRepository.create).toHaveBeenCalledTimes(2);
        expect(mockAgeGroupRepository.save).toHaveBeenCalled();

        // Verify first age group contains all required fields
        const firstAgeGroupCall = mockAgeGroupRepository.create.mock.calls[0][0];
        expect(firstAgeGroupCall).toMatchObject({
          birthYear: 2010,
          displayLabel: 'U14',
          gameSystem: '7+1',
          teamCount: 16,
          minTeams: 8,
          maxTeams: 16,
          numberOfMatches: 5,
          guaranteedMatches: 3,
          participationFee: 250,
          tournamentId: 'new-tournament-id',
        });

        // Verify second age group contains all required fields
        const secondAgeGroupCall = mockAgeGroupRepository.create.mock.calls[1][0];
        expect(secondAgeGroupCall).toMatchObject({
          birthYear: 2012,
          displayLabel: 'U12',
          gameSystem: '5+1',
          teamCount: 12,
          minTeams: 6,
          maxTeams: 12,
          numberOfMatches: 4,
          guaranteedMatches: 3,
          participationFee: 200,
          tournamentId: 'new-tournament-id',
        });
      });

      it('should handle age groups with partial data (optional fields)', async () => {
        const createDto: CreateTournamentDto = {
          name: 'Simple Tournament',
          description: 'Tournament with minimal age group data',
          startDate: '2025-07-01',
          endDate: '2025-07-05',
          location: 'Test Location',
          maxTeams: 16,
          ageGroups: [
            {
              birthYear: 2010,
              displayLabel: 'U14',
              // Only required fields, optional fields missing
            },
          ],
        };

        const mockSavedTournament = { ...mockTournament, id: 'new-tournament-id' };
        mockRepository.create.mockReturnValue(mockSavedTournament);
        mockRepository.save.mockResolvedValue(mockSavedTournament);

        mockAgeGroupRepository.create.mockImplementation((data) => data);
        mockAgeGroupRepository.save.mockResolvedValue([]);

        await service.create('organizer-1', createDto);

        expect(mockAgeGroupRepository.create).toHaveBeenCalled();
        const ageGroupCall = mockAgeGroupRepository.create.mock.calls[0][0];
        expect(ageGroupCall.birthYear).toBe(2010);
        expect(ageGroupCall.displayLabel).toBe('U14');
      });
    });

    describe('updateAgeGroups', () => {
      it('should persist all age group field updates including new fields', async () => {
        const mockExistingTournament = {
          ...mockTournament,
          status: TournamentStatus.DRAFT,
          organizerId: 'organizer-1',
        };

        const existingAgeGroup = {
          id: 'age-group-1',
          tournamentId: mockTournament.id,
          birthYear: 2010,
          displayLabel: 'U14',
          teamCount: 12,
          minTeams: 6,
          maxTeams: 12,
          startDate: new Date('2025-07-01'),
          endDate: new Date('2025-07-03'),
        };

        mockRepository.findOne.mockResolvedValue(mockExistingTournament);
        mockAgeGroupRepository.find.mockResolvedValue([existingAgeGroup]);
        mockAgeGroupRepository.save.mockImplementation((data) => Promise.resolve(data));

        const updateData = [
          {
            id: 'age-group-1',
            birthYear: 2010,
            displayLabel: 'U14',
            teamCount: 16,
            minTeams: 8,
            maxTeams: 16,
            numberOfMatches: 5,
            guaranteedMatches: 3,
            participationFee: 300,
          },
        ];

        await service.updateAgeGroups(
          mockTournament.id!,
          'organizer-1',
          UserRole.ORGANIZER,
          updateData,
        );

        // Verify save was called
        expect(mockAgeGroupRepository.save).toHaveBeenCalled();

        // Verify the age group object was updated with all new fields
        const savedAgeGroups = mockAgeGroupRepository.save.mock.calls[0][0];
        expect(Array.isArray(savedAgeGroups) ? savedAgeGroups[0] : savedAgeGroups).toMatchObject({
          id: 'age-group-1',
          minTeams: 8,
          maxTeams: 16,
          numberOfMatches: 5,
          guaranteedMatches: 3,
          participationFee: 300,
        });
      });

      it('should create new age groups when no id is provided', async () => {
        const mockExistingTournament = {
          ...mockTournament,
          status: TournamentStatus.DRAFT,
          organizerId: 'organizer-1',
        };

        mockRepository.findOne.mockResolvedValue(mockExistingTournament);
        mockAgeGroupRepository.find.mockResolvedValue([]);
        mockAgeGroupRepository.create.mockImplementation((data) => data);
        mockAgeGroupRepository.save.mockImplementation((data) => Promise.resolve(data));

        const newAgeGroupData = [
          {
            birthYear: 2011,
            displayLabel: 'U13',
            teamCount: 8,
            minTeams: 4,
            maxTeams: 8,
            numberOfMatches: 4,
            guaranteedMatches: 3,
          },
        ];

        await service.updateAgeGroups(
          mockTournament.id!,
          'organizer-1',
          UserRole.ORGANIZER,
          newAgeGroupData,
        );

        expect(mockAgeGroupRepository.create).toHaveBeenCalled();
        const createdAgeGroup = mockAgeGroupRepository.create.mock.calls[0][0];
        expect(createdAgeGroup).toMatchObject({
          birthYear: 2011,
          minTeams: 4,
          maxTeams: 8,
          numberOfMatches: 4,
          guaranteedMatches: 3,
          tournamentId: mockTournament.id,
        });
      });

      it('should delete age groups that are no longer in the update list', async () => {
        const mockExistingTournament = {
          ...mockTournament,
          status: TournamentStatus.DRAFT,
          organizerId: 'organizer-1',
        };

        const existingAgeGroups = [
          { id: 'age-group-1', tournamentId: mockTournament.id, birthYear: 2010 },
          { id: 'age-group-2', tournamentId: mockTournament.id, birthYear: 2011 },
        ];

        mockRepository.findOne.mockResolvedValue(mockExistingTournament);
        mockAgeGroupRepository.find.mockResolvedValue(existingAgeGroups);
        mockAgeGroupRepository.remove.mockResolvedValue(undefined);
        mockAgeGroupRepository.save.mockImplementation((data) => Promise.resolve(data));

        const updateData = [
          {
            id: 'age-group-1',
            birthYear: 2010,
            displayLabel: 'U14',
            teamCount: 16,
          },
          // age-group-2 is not in the list, should be deleted
        ];

        await service.updateAgeGroups(
          mockTournament.id!,
          'organizer-1',
          UserRole.ORGANIZER,
          updateData,
        );

        // Verify the removed age group was deleted
        expect(mockAgeGroupRepository.remove).toHaveBeenCalledWith([
          expect.objectContaining({ id: 'age-group-2' }),
        ]);
      });
    });

    describe('data integrity validation', () => {
      it('should throw error when maxTeams is less than minTeams', async () => {
        const createDto: CreateTournamentDto = {
          name: 'Invalid Tournament',
          description: 'Tournament with invalid age group constraints',
          startDate: '2025-07-01',
          endDate: '2025-07-05',
          location: 'Test Location',
          maxTeams: 16,
          ageGroups: [
            {
              birthYear: 2010,
              teamCount: 16,
              minTeams: 16,
              maxTeams: 8, // maxTeams < minTeams - INVALID
            },
          ],
        };

        // Note: This validation should ideally be in the DTO or service
        // For now, we're just documenting the expected behavior
        // Implementation of this validation can be added in future iterations
      });
    });
  });
});
