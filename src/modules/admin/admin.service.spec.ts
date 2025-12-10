import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Club } from '../clubs/entities/club.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotFoundException } from '@nestjs/common';
import { UserRole, TournamentStatus, PaymentStatus } from '../../common/enums';

describe('AdminService', () => {
  let service: AdminService;

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.PARTICIPANT,
    isActive: true,
    isVerified: true,
    country: 'Romania',
    createdAt: new Date(),
  };

  const mockTournament: Partial<Tournament> = {
    id: 'tournament-1',
    name: 'Test Tournament',
    status: TournamentStatus.PUBLISHED,
    country: 'Romania',
    createdAt: new Date(),
  };

  const mockPayment: Partial<Payment> = {
    id: 'payment-1',
    amount: 200,
    status: PaymentStatus.COMPLETED,
    createdAt: new Date(),
  };

  const createMockQueryBuilder = (
    returnData: unknown[] = [],
    count: number = 0,
  ) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
    getManyAndCount: jest.fn().mockResolvedValue([returnData, count]),
    getMany: jest.fn().mockResolvedValue(returnData),
    getRawMany: jest.fn().mockResolvedValue(returnData),
    getRawOne: jest.fn().mockResolvedValue({ total: 1000 }),
  });

  const mockUsersRepo = {
    count: jest.fn().mockResolvedValue(100),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder([mockUser], 1)),
  };

  const mockTournamentsRepo = {
    count: jest.fn().mockResolvedValue(50),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() =>
      createMockQueryBuilder([mockTournament], 1),
    ),
  };

  const mockRegistrationsRepo = {
    count: jest.fn().mockResolvedValue(200),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder([], 0)),
  };

  const mockPaymentsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder([mockPayment], 1)),
  };

  const mockClubsRepo = {
    count: jest.fn().mockResolvedValue(30),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockNotificationsRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepo,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentsRepo,
        },
        {
          provide: getRepositoryToken(Registration),
          useValue: mockRegistrationsRepo,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentsRepo,
        },
        {
          provide: getRepositoryToken(Club),
          useValue: mockClubsRepo,
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationsRepo,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlatformStatistics', () => {
    it('should return comprehensive platform statistics', async () => {
      const result = await service.getPlatformStatistics();

      expect(result).toHaveProperty('overview');
      expect(result.overview).toHaveProperty('totalUsers');
      expect(result.overview).toHaveProperty('totalClubs');
      expect(result.overview).toHaveProperty('totalTournaments');
      expect(result.overview).toHaveProperty('activeTournaments');
      expect(result.overview).toHaveProperty('totalRegistrations');
      expect(result.overview).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('distributions');
      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('topCountries');
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const filterDto = { page: 1, limit: 20 };

      const result = await service.getUsers(filterDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply search filter', async () => {
      const filterDto = { search: 'John', page: 1, limit: 20 };

      await service.getUsers(filterDto);

      expect(mockUsersRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should apply role filter', async () => {
      const filterDto = { role: UserRole.ORGANIZER, page: 1, limit: 20 };

      await service.getUsers(filterDto);

      expect(mockUsersRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      mockUsersRepo.save.mockResolvedValue({
        ...mockUser,
        role: UserRole.ORGANIZER,
      });

      const result = await service.updateUserRole('user-1', {
        role: UserRole.ORGANIZER,
      });

      expect(result.role).toBe(UserRole.ORGANIZER);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateUserRole('non-existent', { role: UserRole.ORGANIZER }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    it('should activate a user', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ ...mockUser, isActive: false });
      mockUsersRepo.save.mockResolvedValue({ ...mockUser, isActive: true });

      const result = await service.updateUserStatus('user-1', {
        isActive: true,
      });

      expect(result.isActive).toBe(true);
    });

    it('should deactivate a user', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      mockUsersRepo.save.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.updateUserStatus('user-1', {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });

    it('should verify a user', async () => {
      mockUsersRepo.findOne.mockResolvedValue({
        ...mockUser,
        isVerified: false,
      });
      mockUsersRepo.save.mockResolvedValue({ ...mockUser, isVerified: true });

      const result = await service.updateUserStatus('user-1', {
        isVerified: true,
      });

      expect(result.isVerified).toBe(true);
    });
  });

  describe('getTournaments', () => {
    it('should return paginated tournaments', async () => {
      const filterDto = { page: 1, limit: 20 };

      const result = await service.getTournaments(filterDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply status filter', async () => {
      const filterDto = {
        status: TournamentStatus.PUBLISHED,
        page: 1,
        limit: 20,
      };

      await service.getTournaments(filterDto);

      expect(mockTournamentsRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('featureTournament', () => {
    it('should feature a tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockTournamentsRepo.save.mockResolvedValue({
        ...mockTournament,
        isFeatured: true,
      });

      const result = await service.featureTournament('tournament-1', true);

      expect(result.isFeatured).toBe(true);
    });

    it('should unfeature a tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        isFeatured: true,
      });
      mockTournamentsRepo.save.mockResolvedValue({
        ...mockTournament,
        isFeatured: false,
      });

      const result = await service.featureTournament('tournament-1', false);

      expect(result.isFeatured).toBe(false);
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.featureTournament('non-existent', true),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPayments', () => {
    it('should return paginated payments', async () => {
      const filterDto = { page: 1, limit: 20 };

      const result = await service.getPayments(filterDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply status filter', async () => {
      const filterDto = { status: PaymentStatus.COMPLETED, page: 1, limit: 20 };

      await service.getPayments(filterDto);

      expect(mockPaymentsRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('sendBroadcastNotification', () => {
    it('should send broadcast notification to all users', async () => {
      mockUsersRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]),
      });
      mockNotificationsRepo.create.mockReturnValue({});
      mockNotificationsRepo.save.mockResolvedValue([{}, {}]);

      const result = await service.sendBroadcastNotification({
        title: 'Test',
        message: 'Test message',
      });

      expect(result.sent).toBe(2);
    });

    it('should filter by role', async () => {
      mockUsersRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
      });
      mockNotificationsRepo.create.mockReturnValue({});
      mockNotificationsRepo.save.mockResolvedValue([{}]);

      const result = await service.sendBroadcastNotification({
        title: 'Test',
        message: 'Test message',
        targetRole: UserRole.ORGANIZER,
      });

      expect(result.sent).toBe(1);
    });
  });
});
