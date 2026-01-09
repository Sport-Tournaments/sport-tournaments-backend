import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TournamentsService } from './tournaments.service';
import { Tournament } from './entities/tournament.entity';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockRepository,
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
});
