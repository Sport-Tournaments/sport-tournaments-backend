import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Club } from '../clubs/entities/club.entity';
import {
  CreateRegistrationDto,
  UpdateRegistrationDto,
  AdminUpdateRegistrationDto,
  RegistrationFilterDto,
  ApproveRegistrationDto,
  RejectRegistrationDto,
  BulkReviewDto,
} from './dto';
import { PaginationDto } from '../../common/dto';
import { PaginatedResponse } from '../../common/interfaces';
import {
  RegistrationStatus,
  TournamentStatus,
  UserRole,
  PaymentStatus,
} from '../../common/enums';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Registration)
    private registrationsRepository: Repository<Registration>,
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Club)
    private clubsRepository: Repository<Club>,
  ) {}

  async create(
    tournamentId: string,
    userId: string,
    createRegistrationDto: CreateRegistrationDto,
  ): Promise<Registration> {
    // Get tournament
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check if tournament is accepting registrations
    if (tournament.status !== TournamentStatus.PUBLISHED) {
      throw new BadRequestException(
        'Tournament is not accepting registrations',
      );
    }

    // Check if registration deadline has passed
    if (
      tournament.registrationDeadline &&
      new Date() > tournament.registrationDeadline
    ) {
      throw new BadRequestException('Registration deadline has passed');
    }

    // Check if tournament is full
    if (tournament.currentTeams >= tournament.maxTeams) {
      throw new BadRequestException('Tournament is full');
    }

    // Get club and verify ownership
    const club = await this.clubsRepository.findOne({
      where: { id: createRegistrationDto.clubId },
    });

    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (club.organizerId !== userId) {
      throw new ForbiddenException('You can only register your own clubs');
    }

    // Check if club is already registered
    const existingRegistration = await this.registrationsRepository.findOne({
      where: {
        tournamentId,
        clubId: createRegistrationDto.clubId,
      },
    });

    if (existingRegistration) {
      throw new ConflictException(
        'This club is already registered for this tournament',
      );
    }

    // Create registration
    const registration = this.registrationsRepository.create({
      ...createRegistrationDto,
      tournamentId,
      status: RegistrationStatus.PENDING,
      paymentStatus:
        tournament.participationFee > 0
          ? PaymentStatus.PENDING
          : PaymentStatus.COMPLETED,
    });

    const savedRegistration =
      await this.registrationsRepository.save(registration);

    // Update tournament team count
    await this.tournamentsRepository.increment(
      { id: tournamentId },
      'currentTeams',
      1,
    );

    return savedRegistration;
  }

  async findByTournament(
    tournamentId: string,
    pagination: PaginationDto,
    filters?: RegistrationFilterDto,
  ): Promise<PaginatedResponse<Registration>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.registrationsRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.club', 'club')
      .leftJoinAndSelect('registration.tournament', 'tournament')
      .where('registration.tournamentId = :tournamentId', { tournamentId });

    if (filters?.status) {
      queryBuilder.andWhere('registration.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.paymentStatus) {
      queryBuilder.andWhere('registration.paymentStatus = :paymentStatus', {
        paymentStatus: filters.paymentStatus,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere('LOWER(club.name) LIKE LOWER(:search)', {
        search: `%${filters.search}%`,
      });
    }

    const [registrations, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('registration.registrationDate', 'DESC')
      .getManyAndCount();

    return {
      data: registrations,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string): Promise<Registration | null> {
    return this.registrationsRepository.findOne({
      where: { id },
      relations: ['club', 'tournament', 'payment'],
    });
  }

  async findByIdOrFail(id: string): Promise<Registration> {
    const registration = await this.findById(id);

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    return registration;
  }

  async findByClub(clubId: string): Promise<Registration[]> {
    return this.registrationsRepository.find({
      where: { clubId },
      relations: ['tournament'],
      order: { registrationDate: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<Registration[]> {
    const clubs = await this.clubsRepository.find({
      where: { organizerId: userId },
    });

    const clubIds = clubs.map((club) => club.id);

    if (clubIds.length === 0) {
      return [];
    }

    return this.registrationsRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.club', 'club')
      .leftJoinAndSelect('registration.tournament', 'tournament')
      .where('registration.clubId IN (:...clubIds)', { clubIds })
      .orderBy('registration.registrationDate', 'DESC')
      .getMany();
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateRegistrationDto: UpdateRegistrationDto,
  ): Promise<Registration> {
    const registration = await this.findByIdOrFail(id);

    // Check if user owns the club
    const club = await this.clubsRepository.findOne({
      where: { id: registration.clubId },
    });

    if (club?.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to update this registration',
      );
    }

    // Can only update pending registrations
    if (
      registration.status !== RegistrationStatus.PENDING &&
      userRole !== UserRole.ADMIN
    ) {
      throw new BadRequestException('Can only update pending registrations');
    }

    Object.assign(registration, updateRegistrationDto);

    return this.registrationsRepository.save(registration);
  }

  async adminUpdate(
    id: string,
    adminUpdateRegistrationDto: AdminUpdateRegistrationDto,
  ): Promise<Registration> {
    const registration = await this.findByIdOrFail(id);

    Object.assign(registration, adminUpdateRegistrationDto);

    return this.registrationsRepository.save(registration);
  }

  async approve(
    id: string, 
    userId: string, 
    userRole: string,
    dto?: ApproveRegistrationDto,
  ): Promise<Registration> {
    const registration = await this.findByIdOrFail(id);

    // Only tournament organizer or admin can approve
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: registration.tournamentId },
    });

    if (tournament?.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to approve this registration',
      );
    }

    if (registration.status !== RegistrationStatus.PENDING) {
      throw new BadRequestException('Can only approve pending registrations');
    }

    registration.status = RegistrationStatus.APPROVED;
    registration.reviewedById = userId;
    registration.reviewedAt = new Date();
    if (dto?.reviewNotes) {
      registration.reviewNotes = dto.reviewNotes;
    }

    return this.registrationsRepository.save(registration);
  }

  async reject(
    id: string, 
    userId: string, 
    userRole: string,
    dto?: RejectRegistrationDto,
  ): Promise<Registration> {
    const registration = await this.findByIdOrFail(id);

    // Only tournament organizer or admin can reject
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: registration.tournamentId },
    });

    if (tournament?.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to reject this registration',
      );
    }

    if (registration.status !== RegistrationStatus.PENDING) {
      throw new BadRequestException('Can only reject pending registrations');
    }

    registration.status = RegistrationStatus.REJECTED;
    registration.reviewedById = userId;
    registration.reviewedAt = new Date();
    if (dto?.rejectionReason) {
      registration.rejectionReason = dto.rejectionReason;
    }
    if (dto?.reviewNotes) {
      registration.reviewNotes = dto.reviewNotes;
    }

    // Decrease tournament team count
    await this.tournamentsRepository.decrement(
      { id: registration.tournamentId },
      'currentTeams',
      1,
    );

    return this.registrationsRepository.save(registration);
  }

  async withdraw(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<Registration> {
    const registration = await this.findByIdOrFail(id);

    // Check if user owns the club
    const club = await this.clubsRepository.findOne({
      where: { id: registration.clubId },
    });

    if (club?.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to withdraw this registration',
      );
    }

    if (registration.status === RegistrationStatus.WITHDRAWN) {
      throw new BadRequestException('Registration is already withdrawn');
    }

    const previousStatus = registration.status;
    registration.status = RegistrationStatus.WITHDRAWN;

    // Decrease tournament team count if was not rejected
    if (previousStatus !== RegistrationStatus.REJECTED) {
      await this.tournamentsRepository.decrement(
        { id: registration.tournamentId },
        'currentTeams',
        1,
      );
    }

    return this.registrationsRepository.save(registration);
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const registration = await this.findByIdOrFail(id);

    // Check if user owns the club or is tournament organizer
    const club = await this.clubsRepository.findOne({
      where: { id: registration.clubId },
    });

    const tournament = await this.tournamentsRepository.findOne({
      where: { id: registration.tournamentId },
    });

    const isClubOwner = club?.organizerId === userId;
    const isTournamentOrganizer = tournament?.organizerId === userId;

    if (!isClubOwner && !isTournamentOrganizer && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to delete this registration',
      );
    }

    // Decrease tournament team count if not already rejected/withdrawn
    if (
      registration.status !== RegistrationStatus.REJECTED &&
      registration.status !== RegistrationStatus.WITHDRAWN
    ) {
      await this.tournamentsRepository.decrement(
        { id: registration.tournamentId },
        'currentTeams',
        1,
      );
    }

    await this.registrationsRepository.remove(registration);
  }

  async getStatusStatistics(tournamentId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    withdrawn: number;
    paidCount: number;
    unpaidCount: number;
  }> {
    const stats = await this.registrationsRepository
      .createQueryBuilder('registration')
      .select('registration.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('registration.tournamentId = :tournamentId', { tournamentId })
      .groupBy('registration.status')
      .getRawMany();

    const paymentStats = await this.registrationsRepository
      .createQueryBuilder('registration')
      .select('registration.paymentStatus', 'paymentStatus')
      .addSelect('COUNT(*)', 'count')
      .where('registration.tournamentId = :tournamentId', { tournamentId })
      .groupBy('registration.paymentStatus')
      .getRawMany();

    const statusMap = stats.reduce(
      (acc, item) => ({ ...acc, [item.status]: parseInt(item.count, 10) }),
      {},
    );

    const paymentMap = paymentStats.reduce(
      (acc, item) => ({
        ...acc,
        [item.paymentStatus]: parseInt(item.count, 10),
      }),
      {},
    );

    const total = Object.values(statusMap).reduce(
      (a: number, b: number) => a + b,
      0,
    ) as number;

    return {
      total,
      pending: statusMap[RegistrationStatus.PENDING] || 0,
      approved: statusMap[RegistrationStatus.APPROVED] || 0,
      rejected: statusMap[RegistrationStatus.REJECTED] || 0,
      withdrawn: statusMap[RegistrationStatus.WITHDRAWN] || 0,
      paidCount: paymentMap[PaymentStatus.COMPLETED] || 0,
      unpaidCount:
        (paymentMap[PaymentStatus.PENDING] || 0) +
        (paymentMap[PaymentStatus.FAILED] || 0),
    };
  }

  async getApprovedRegistrations(
    tournamentId: string,
  ): Promise<Registration[]> {
    return this.registrationsRepository.find({
      where: {
        tournamentId,
        status: RegistrationStatus.APPROVED,
      },
      relations: ['club'],
      order: { registrationDate: 'ASC' },
    });
  }

  /**
   * Bulk approve multiple registrations
   */
  async bulkApprove(
    tournamentId: string,
    userId: string,
    userRole: string,
    dto: BulkReviewDto,
  ): Promise<{ approved: number; failed: string[] }> {
    // Verify tournament ownership
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not allowed to approve registrations for this tournament');
    }

    const results = { approved: 0, failed: [] as string[] };

    for (const registrationId of dto.registrationIds) {
      try {
        const registration = await this.registrationsRepository.findOne({
          where: { id: registrationId, tournamentId },
        });

        if (!registration) {
          results.failed.push(`${registrationId}: Not found`);
          continue;
        }

        if (registration.status !== RegistrationStatus.PENDING) {
          results.failed.push(`${registrationId}: Not in pending status`);
          continue;
        }

        registration.status = RegistrationStatus.APPROVED;
        registration.reviewedById = userId;
        registration.reviewedAt = new Date();
        if (dto.reviewNotes) {
          registration.reviewNotes = dto.reviewNotes;
        }

        await this.registrationsRepository.save(registration);
        results.approved++;
      } catch {
        results.failed.push(`${registrationId}: Processing error`);
      }
    }

    return results;
  }

  /**
   * Bulk reject multiple registrations
   */
  async bulkReject(
    tournamentId: string,
    userId: string,
    userRole: string,
    dto: BulkReviewDto & { rejectionReason: string },
  ): Promise<{ rejected: number; failed: string[] }> {
    // Verify tournament ownership
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not allowed to reject registrations for this tournament');
    }

    const results = { rejected: 0, failed: [] as string[] };

    for (const registrationId of dto.registrationIds) {
      try {
        const registration = await this.registrationsRepository.findOne({
          where: { id: registrationId, tournamentId },
        });

        if (!registration) {
          results.failed.push(`${registrationId}: Not found`);
          continue;
        }

        if (registration.status !== RegistrationStatus.PENDING) {
          results.failed.push(`${registrationId}: Not in pending status`);
          continue;
        }

        registration.status = RegistrationStatus.REJECTED;
        registration.reviewedById = userId;
        registration.reviewedAt = new Date();
        registration.rejectionReason = dto.rejectionReason;
        if (dto.reviewNotes) {
          registration.reviewNotes = dto.reviewNotes;
        }

        await this.registrationsRepository.save(registration);

        // Decrease tournament team count
        await this.tournamentsRepository.decrement(
          { id: tournamentId },
          'currentTeams',
          1,
        );

        results.rejected++;
      } catch {
        results.failed.push(`${registrationId}: Processing error`);
      }
    }

    return results;
  }

  /**
   * Get pending registrations for review
   */
  async getPendingReview(
    tournamentId: string,
    userId: string,
    userRole: string,
  ): Promise<Registration[]> {
    // Verify tournament ownership
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not allowed to view registrations for this tournament');
    }

    return this.registrationsRepository.find({
      where: {
        tournamentId,
        status: RegistrationStatus.PENDING,
      },
      relations: ['club', 'club.owner'],
      order: { registrationDate: 'ASC' },
    });
  }
}
