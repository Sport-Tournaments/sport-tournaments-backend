import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto, AdminUpdateUserDto } from './dto';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UserRole } from '../../common/enums';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.PARTICIPANT,
    isActive: true,
    isVerified: true,
    country: 'Romania',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockQueryBuilder = () => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
    getOne: jest.fn().mockResolvedValue(mockUser),
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
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      firstName: 'Jane',
      lastName: 'Doe',
      country: 'Romania',
      role: UserRole.PARTICIPANT,
    };

    it('should create a user successfully', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockRepository.create.mockReturnValue({ ...mockUser, ...createDto });
      mockRepository.save.mockResolvedValue({ ...mockUser, ...createDto });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const pagination = { page: 1, pageSize: 20 };

      const result = await service.findAll(pagination);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply filters when provided', async () => {
      const pagination = { page: 1, pageSize: 20 };
      const filters = { role: UserRole.ORGANIZER, country: 'Romania' };

      await service.findAll(pagination, filters);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    });

    it('should apply search filter', async () => {
      const pagination = { page: 1, pageSize: 20 };
      const filters = { search: 'John' };

      await service.findAll(pagination, filters);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return a user by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByIdOrFail('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if email not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update user successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue({ ...mockUser, ...updateDto });

      const result = await service.update('user-1', updateDto);

      expect(result.firstName).toBe('Updated');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adminUpdate', () => {
    const adminUpdateDto: AdminUpdateUserDto = {
      role: UserRole.ORGANIZER,
      isVerified: true,
    };

    it('should update user with admin privileges', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue({ ...mockUser, ...adminUpdateDto });

      const result = await service.adminUpdate('user-1', adminUpdateDto);

      expect(result.role).toBe(UserRole.ORGANIZER);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.remove.mockResolvedValue(mockUser);

      await service.remove('user-1');

      expect(mockRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.deactivate('user-1');

      expect(result.isActive).toBe(false);
    });
  });

  describe('activate', () => {
    it('should activate a user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockRepository.findOne.mockResolvedValue(inactiveUser);
      mockRepository.save.mockResolvedValue({
        ...inactiveUser,
        isActive: true,
      });

      const result = await service.activate('user-1');

      expect(result.isActive).toBe(true);
    });
  });
});
