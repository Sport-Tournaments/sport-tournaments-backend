import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType, UserRole } from '../../common/enums';
import { PaginationDto } from '../../common/dto';
import { PaginatedResponse } from '../../common/interfaces';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedTournamentId?: string;
  relatedRegistrationId?: string;
  sendEmailNotification?: boolean;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationsRepository.create(createNotificationDto);
    const savedNotification = await this.notificationsRepository.save(notification);

    // TODO: If sendEmailNotification is true, queue email sending job
    if (createNotificationDto.sendEmailNotification) {
      // This would typically dispatch to a queue/job system
      console.log(`Email notification queued for user ${createNotificationDto.userId}`);
    }

    return savedNotification;
  }

  async findByUser(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<Notification>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [notifications, total] = await this.notificationsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string): Promise<Notification | null> {
    return this.notificationsRepository.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<Notification> {
    const notification = await this.findById(id);

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.findByIdOrFail(id);

    if (notification.userId !== userId) {
      throw new ForbiddenException('You cannot mark this notification as read');
    }

    notification.isRead = true;
    return this.notificationsRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const notification = await this.findByIdOrFail(id);

    if (notification.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You cannot delete this notification');
    }

    await this.notificationsRepository.remove(notification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.count({
      where: { userId, isRead: false },
    });
  }

  // Helper methods for creating specific notification types
  async notifyRegistrationConfirmation(
    userId: string,
    tournamentName: string,
    tournamentId: string,
    registrationId: string,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.REGISTRATION_CONFIRMATION,
      title: 'Registration Confirmed',
      message: `Your registration for "${tournamentName}" has been received and is pending approval.`,
      relatedTournamentId: tournamentId,
      relatedRegistrationId: registrationId,
      sendEmailNotification: true,
    });
  }

  async notifyRegistrationApproved(
    userId: string,
    tournamentName: string,
    tournamentId: string,
    registrationId: string,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.REGISTRATION_APPROVED,
      title: 'Registration Approved',
      message: `Your registration for "${tournamentName}" has been approved!`,
      relatedTournamentId: tournamentId,
      relatedRegistrationId: registrationId,
      sendEmailNotification: true,
    });
  }

  async notifyRegistrationRejected(
    userId: string,
    tournamentName: string,
    tournamentId: string,
    registrationId: string,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.REGISTRATION_REJECTED,
      title: 'Registration Rejected',
      message: `Your registration for "${tournamentName}" has been rejected. Please contact the organizer for more information.`,
      relatedTournamentId: tournamentId,
      relatedRegistrationId: registrationId,
      sendEmailNotification: true,
    });
  }

  async notifyGroupDraw(
    userId: string,
    tournamentName: string,
    tournamentId: string,
    groupLetter: string,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.GROUP_DRAW,
      title: 'Group Draw Complete',
      message: `The group draw for "${tournamentName}" has been completed. Your team has been assigned to Group ${groupLetter}.`,
      relatedTournamentId: tournamentId,
      sendEmailNotification: true,
      metadata: { groupLetter },
    });
  }

  async notifyPaymentReminder(
    userId: string,
    tournamentName: string,
    tournamentId: string,
    registrationId: string,
    daysUntilDeadline: number,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.PAYMENT_REMINDER,
      title: 'Payment Reminder',
      message: `Reminder: Payment for "${tournamentName}" is due in ${daysUntilDeadline} days. Please complete your payment to secure your spot.`,
      relatedTournamentId: tournamentId,
      relatedRegistrationId: registrationId,
      sendEmailNotification: true,
      metadata: { daysUntilDeadline },
    });
  }

  async notifyPaymentCompleted(
    userId: string,
    tournamentName: string,
    tournamentId: string,
    registrationId: string,
    amount: number,
    currency: string,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.PAYMENT_COMPLETED,
      title: 'Payment Successful',
      message: `Your payment of ${amount} ${currency} for "${tournamentName}" has been successfully processed.`,
      relatedTournamentId: tournamentId,
      relatedRegistrationId: registrationId,
      sendEmailNotification: true,
      metadata: { amount, currency },
    });
  }

  async notifyTournamentCancelled(
    userId: string,
    tournamentName: string,
    tournamentId: string,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.TOURNAMENT_CANCELLED,
      title: 'Tournament Cancelled',
      message: `Unfortunately, "${tournamentName}" has been cancelled. If you made a payment, a refund will be processed.`,
      relatedTournamentId: tournamentId,
      sendEmailNotification: true,
    });
  }
}
