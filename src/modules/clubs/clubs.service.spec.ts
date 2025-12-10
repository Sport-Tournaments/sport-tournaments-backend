import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubsService } from './clubs.service';
import { Club } from './entities/club.entity';
import { CreateClubDto, UpdateClubDto } from './dto';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums';

describe('ClubsService', () => {
  let service: ClubsService;
  let repository: Repository<Club>;

  const mockClub: Partial<Club> = {
    id: 'club-1',
    name: 'Test FC',
    city: 'Brașov',
    country: 'Romania',
    organizerId: 'owner-1',
    foundedYear: 2000,
    logoUrl: 'https://example.com/logo.png',
    website: 'https://testfc.com',
    contactEmail: 'contact@testfc.com',
    contactPhone: '+40 123 456 789',
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockClub], 1]),
      getOne: jest.fn().mockResolvedValue(mockClub),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubsService,
        {
          provide: getRepositoryToken(Club),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ClubsService>(ClubsService);
    repository = module.get<Repository<Club>>(getRepositoryToken(Club));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateClubDto = {
      name: 'New FC',
      city: 'Cluj-Napoca',
      country: 'Romania',
      foundedYear: 2010,
    };

    it('should create a club successfully', async () => {
      mockRepository.findOne.mockResolvedValue(null); // No existing club with same name
      mockRepository.create.mockReturnValue(mockClub);
      mockRepository.save.mockResolvedValue(mockClub);

      const result = await service.create('owner-1', createDto);

      expect(result).toEqual(mockClub);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if club name already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);

      await expect(service.create('owner-1', createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated clubs', async () => {
      const pagination = { page: 1, pageSize: 20 };

      const result = await service.findAll(pagination);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return a club by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);

      const result = await service.findById('club-1');

      expect(result).toEqual(mockClub);
    });

    it('should return null if club not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return a club by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);

      const result = await service.findByIdOrFail('club-1');

      expect(result).toEqual(mockClub);
    });

    it('should throw NotFoundException if club not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateClubDto = {
      city: 'Cluj-Napoca',
    };

    it('should update club when user is owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);
      mockRepository.save.mockResolvedValue({ ...mockClub, ...updateDto });

      const result = await service.update(
        'club-1',
        'owner-1',
        UserRole.ORGANIZER,
        updateDto,
      );

      expect(result.city).toBe('Cluj-Napoca');
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);

      await expect(
        service.update('club-1', 'other-user', UserRole.ORGANIZER, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to update any club', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);
      mockRepository.save.mockResolvedValue({ ...mockClub, ...updateDto });

      const result = await service.update(
        'club-1',
        'admin-user',
        UserRole.ADMIN,
        updateDto,
      );

      expect(result).toBeDefined();
    });

    it('should throw ConflictException if new name already exists', async () => {
      const updateDtoWithName: UpdateClubDto = { name: 'Existing FC' };
      const existingClub = { ...mockClub, id: 'club-2', name: 'Existing FC' };

      mockRepository.findOne
        .mockResolvedValueOnce(mockClub) // findByIdOrFail
        .mockResolvedValueOnce(existingClub); // Check for existing name

      await expect(
        service.update('club-1', 'owner-1', UserRole.ORGANIZER, updateDtoWithName),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a club when user is owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);
      mockRepository.remove.mockResolvedValue(mockClub);

      await service.remove('club-1', 'owner-1', UserRole.ORGANIZER);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockClub);
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);

      await expect(
        service.remove('club-1', 'other-user', UserRole.ORGANIZER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to remove any club', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);
      mockRepository.remove.mockResolvedValue(mockClub);

      await service.remove('club-1', 'admin-user', UserRole.ADMIN);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockClub);
    });
  });

  describe('findByOrganizer', () => {
    it('should return clubs by organizer id', async () => {
      mockRepository.find.mockResolvedValue([mockClub]);

      const result = await service.findByOrganizer('owner-1');

      expect(result).toHaveLength(1);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizerId: 'owner-1' },
        order: { name: 'ASC' },
      });
    });
  });

  describe('verify', () => {
    it('should verify a club', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);
      mockRepository.save.mockResolvedValue({ ...mockClub, isVerified: true });

      const result = await service.verify('club-1');

      expect(result.isVerified).toBe(true);
    });
  });

  describe('unverify', () => {
    it('should unverify a club', async () => {
      const verifiedClub = { ...mockClub, isVerified: true };
      mockRepository.findOne.mockResolvedValue(verifiedClub);
      mockRepository.save.mockResolvedValue({ ...verifiedClub, isVerified: false });

      const result = await service.unverify('club-1');

      expect(result.isVerified).toBe(false);
    });
  });

  describe('setPremium', () => {
    it('should set club premium status', async () => {
      mockRepository.findOne.mockResolvedValue(mockClub);
      mockRepository.save.mockResolvedValue({ ...mockClub, isPremium: true });

      const result = await service.setPremium('club-1', true);

      expect(result.isPremium).toBe(true);
    });
  });
});
