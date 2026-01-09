import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Club } from '../clubs/entities/club.entity';
import { Notification } from '../notifications/entities/notification.entity';
import {
  AdminUserFilterDto,
  AdminTournamentFilterDto,
  AdminPaymentFilterDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  AdminActionDto,
} from './dto';
import {
  TournamentStatus,
  PaymentStatus,
  NotificationType,
} from '../../common/enums';
import { PaginatedResponse } from '../../common/interfaces';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Registration)
    private registrationsRepository: Repository<Registration>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Club)
    private clubsRepository: Repository<Club>,
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  // Platform Statistics
  async getPlatformStatistics(): Promise<Record<string, any>> {
    const [
      totalUsers,
      totalClubs,
      totalTournaments,
      activeTournaments,
      totalRegistrations,
      totalPayments,
      recentUsers,
      recentTournaments,
    ] = await Promise.all([
      this.usersRepository.count(),
      this.clubsRepository.count(),
      this.tournamentsRepository.count(),
      this.tournamentsRepository.count({
        where: { status: TournamentStatus.PUBLISHED },
      }),
      this.registrationsRepository.count(),
      this.paymentsRepository
        .createQueryBuilder('payment')
        .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
        .select('SUM(payment.amount)', 'total')
        .getRawOne(),
      this.usersRepository.count({
        where: {
          createdAt: Between(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            new Date(),
          ),
        },
      }),
      this.tournamentsRepository.count({
        where: {
          createdAt: Between(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            new Date(),
          ),
        },
      }),
    ]);

    // User role distribution
    const userRoleDistribution = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    // Tournament status distribution
    const tournamentStatusDistribution = await this.tournamentsRepository
      .createQueryBuilder('tournament')
      .select('tournament.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tournament.status')
      .getRawMany();

    // Monthly registration trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const registrationTrend = await this.registrationsRepository
      .createQueryBuilder('registration')
      .select("DATE_FORMAT(registration.createdAt, '%Y-%m')", 'month')
      .addSelect('COUNT(*)', 'count')
      .where('registration.createdAt >= :date', { date: sixMonthsAgo })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // Revenue trend
    const revenueTrend = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select("DATE_FORMAT(payment.createdAt, '%Y-%m')", 'month')
      .addSelect('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.createdAt >= :date', { date: sixMonthsAgo })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // Top countries
    const topCountries = await this.tournamentsRepository
      .createQueryBuilder('tournament')
      .select('tournament.country', 'country')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tournament.country')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      overview: {
        totalUsers,
        totalClubs,
        totalTournaments,
        activeTournaments,
        totalRegistrations,
        totalRevenue: totalPayments?.total || 0,
        recentUsers,
        recentTournaments,
      },
      distributions: {
        userRoles: userRoleDistribution,
        tournamentStatuses: tournamentStatusDistribution,
      },
      trends: {
        registrations: registrationTrend,
        revenue: revenueTrend,
      },
      topCountries,
    };
  }

  // User Management
  async getUsers(
    filterDto: AdminUserFilterDto,
  ): Promise<PaginatedResponse<User>> {
    const {
      search,
      role,
      isActive,
      isVerified,
      country,
      page = 1,
      limit = 20,
    } = filterDto;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.clubs', 'clubs');

    if (search) {
      queryBuilder.andWhere(
        '(user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    if (isVerified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', { isVerified });
    }

    if (country) {
      queryBuilder.andWhere('user.country = :country', { country });
    }

    const total = await queryBuilder.getCount();

    queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.createdAt', 'DESC');

    const users = await queryBuilder.getMany();

    // Remove passwords
    users.forEach((user) => delete user.password);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['clubs', 'tournaments', 'notifications'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    delete user.password;
    return user;
  }

  async updateUserRole(id: string, dto: UpdateUserRoleDto): Promise<User> {
    const user = await this.getUserDetails(id);
    user.role = dto.role;
    await this.usersRepository.save(user);

    this.logger.log(`User ${id} role updated to ${dto.role}`);
    return user;
  }

  async updateUserStatus(id: string, dto: UpdateUserStatusDto): Promise<User> {
    const user = await this.getUserDetails(id);

    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }

    if (dto.isVerified !== undefined) {
      user.isVerified = dto.isVerified;
    }

    await this.usersRepository.save(user);
    this.logger.log(`User ${id} status updated`);
    return user;
  }

  async deleteUser(id: string, dto: AdminActionDto): Promise<void> {
    const user = await this.getUserDetails(id);

    // Instead of hard delete, we deactivate
    user.isActive = false;
    await this.usersRepository.save(user);

    this.logger.log(
      `User ${id} deactivated. Reason: ${dto.reason || 'Not provided'}`,
    );
  }

  // Tournament Moderation
  async getTournaments(
    filterDto: AdminTournamentFilterDto,
  ): Promise<PaginatedResponse<Tournament>> {
    const {
      search,
      status,
      organizerId,
      country,
      page = 1,
      limit = 20,
    } = filterDto;

    const queryBuilder = this.tournamentsRepository
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.organizer', 'organizer');

    if (search) {
      queryBuilder.andWhere(
        '(tournament.name LIKE :search OR tournament.city LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('tournament.status = :status', { status });
    }

    if (organizerId) {
      queryBuilder.andWhere('tournament.organizerId = :organizerId', {
        organizerId,
      });
    }

    if (country) {
      queryBuilder.andWhere('tournament.country = :country', { country });
    }

    const total = await queryBuilder.getCount();

    queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('tournament.createdAt', 'DESC');

    const tournaments = await queryBuilder.getMany();

    return {
      data: tournaments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async forceCancelTournament(
    id: string,
    dto: AdminActionDto,
  ): Promise<Tournament> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id },
      relations: ['organizer', 'registrations'],
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${id} not found`);
    }

    tournament.status = TournamentStatus.CANCELLED;
    await this.tournamentsRepository.save(tournament);

    // Notify organizer
    await this.notificationsRepository.save({
      userId: tournament.organizer.id,
      type: NotificationType.TOURNAMENT_UPDATE,
      title: 'Tournament Cancelled by Admin',
      message: `Your tournament "${tournament.name}" has been cancelled by an administrator. Reason: ${dto.reason || 'Policy violation'}`,
    });

    this.logger.log(
      `Tournament ${id} force cancelled by admin. Reason: ${dto.reason}`,
    );
    return tournament;
  }

  async featureTournament(id: string, featured: boolean): Promise<Tournament> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${id} not found`);
    }

    tournament.isFeatured = featured;
    await this.tournamentsRepository.save(tournament);

    this.logger.log(`Tournament ${id} featured status set to ${featured}`);
    return tournament;
  }

  // Payment Reconciliation
  async getPayments(
    filterDto: AdminPaymentFilterDto,
  ): Promise<PaginatedResponse<Payment>> {
    const { status, tournamentId, userId, page = 1, limit = 20 } = filterDto;

    const queryBuilder = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .leftJoinAndSelect('payment.tournament', 'tournament')
      .leftJoinAndSelect('payment.registration', 'registration');

    if (status) {
      queryBuilder.andWhere('payment.status = :status', { status });
    }

    if (tournamentId) {
      queryBuilder.andWhere('payment.tournamentId = :tournamentId', {
        tournamentId,
      });
    }

    if (userId) {
      queryBuilder.andWhere('payment.userId = :userId', { userId });
    }

    const total = await queryBuilder.getCount();

    queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('payment.createdAt', 'DESC');

    const payments = await queryBuilder.getMany();

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentReport(
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, any>> {
    const payments = await this.paymentsRepository
      .createQueryBuilder('payment')
      .where('payment.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getMany();

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalFees = payments.reduce(
      (sum, p) => sum + Number(p.stripeFee || 0),
      0,
    );

    // Group by currency
    const byCurrency = payments.reduce(
      (acc, p) => {
        const currency = p.currency || 'EUR';
        if (!acc[currency]) {
          acc[currency] = { count: 0, total: 0 };
        }
        acc[currency].count++;
        acc[currency].total += Number(p.amount);
        return acc;
      },
      {} as Record<string, { count: number; total: number }>,
    );

    return {
      period: { startDate, endDate },
      summary: {
        totalPayments: payments.length,
        totalRevenue,
        totalFees,
        netRevenue: totalRevenue - totalFees,
      },
      byCurrency,
    };
  }

  // System Actions
  async sendBroadcastNotification(
    title: string,
    message: string,
    targetRole?: string,
  ): Promise<{ sent: number }> {
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (targetRole) {
      queryBuilder.where('user.role = :role', { role: targetRole });
    }

    const users = await queryBuilder.getMany();

    const notifications = users.map((user) => ({
      userId: user.id,
      type: NotificationType.SYSTEM,
      title,
      message,
    }));

    await this.notificationsRepository.save(notifications);

    this.logger.log(`Broadcast notification sent to ${users.length} users`);
    return { sent: users.length };
  }

  async getAuditLog(page = 1, limit = 50): Promise<PaginatedResponse<any>> {
    // In a real implementation, this would query an audit log table
    // For now, return placeholder
    return {
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    };
  }
}
