import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationType, UserRole } from '../../common/enums';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockNotification: Partial<Notification> = {
    id: 'notification-1',
    userId: 'user-1',
    type: NotificationType.REGISTRATION_CONFIRMATION,
    title: 'Registration Confirmed',
    message: 'Your registration has been confirmed.',
    isRead: false,
    createdAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      userId: 'user-1',
      type: NotificationType.REGISTRATION_CONFIRMATION,
      title: 'Test Notification',
      message: 'Test message',
      sendEmailNotification: false,
    };

    it('should create a notification successfully', async () => {
      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      const result = await service.create(createDto);

      expect(result).toEqual(mockNotification);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create notification with email flag', async () => {
      const dtoWithEmail = { ...createDto, sendEmailNotification: true };
      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.create(dtoWithEmail);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email notification queued'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('findByUser', () => {
    it('should return paginated notifications for a user', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockNotification], 1]);
      const pagination = { page: 1, pageSize: 20 };

      const result = await service.findByUser('user-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle pagination correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockNotification], 100]);
      const pagination = { page: 3, pageSize: 10 };

      const result = await service.findByUser('user-1', pagination);

      expect(result.meta.page).toBe(3);
      expect(result.meta.totalPages).toBe(10);
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: 20,
        take: 10,
      });
    });
  });

  describe('findById', () => {
    it('should return a notification by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.findById('notification-1');

      expect(result).toEqual(mockNotification);
    });

    it('should return null if notification not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return a notification by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.findByIdOrFail('notification-1');

      expect(result).toEqual(mockNotification);
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);
      mockRepository.save.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      const result = await service.markAsRead('notification-1', 'user-1');

      expect(result.isRead).toBe(true);
    });

    it('should throw ForbiddenException if user does not own notification', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockNotification,
        userId: 'other-user',
      });

      await expect(
        service.markAsRead('notification-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      mockRepository.update.mockResolvedValue({ affected: 5 });

      await service.markAllAsRead('user-1');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        { isRead: true },
      );
    });
  });

  describe('remove', () => {
    it('should remove notification when user is owner', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);
      mockRepository.remove.mockResolvedValue(mockNotification);

      await service.remove('notification-1', 'user-1', UserRole.PARTICIPANT);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockNotification);
    });

    it('should allow admin to remove any notification', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockNotification,
        userId: 'other-user',
      });
      mockRepository.remove.mockResolvedValue(mockNotification);

      await service.remove('notification-1', 'admin-user', UserRole.ADMIN);

      expect(mockRepository.remove).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user does not own notification', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockNotification,
        userId: 'other-user',
      });

      await expect(
        service.remove('notification-1', 'user-1', UserRole.PARTICIPANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(5);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });
  });

  describe('notifyRegistrationConfirmation', () => {
    it('should create registration confirmation notification', async () => {
      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      await service.notifyRegistrationConfirmation(
        'user-1',
        'Test Tournament',
        'tournament-1',
        'registration-1',
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.REGISTRATION_CONFIRMATION,
          title: 'Registration Confirmed',
          relatedTournamentId: 'tournament-1',
          relatedRegistrationId: 'registration-1',
          sendEmailNotification: true,
        }),
      );
    });
  });

  describe('notifyRegistrationApproved', () => {
    it('should create registration approved notification', async () => {
      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      await service.notifyRegistrationApproved(
        'user-1',
        'Test Tournament',
        'tournament-1',
        'registration-1',
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.REGISTRATION_APPROVED,
          title: 'Registration Approved',
        }),
      );
    });
  });
});
