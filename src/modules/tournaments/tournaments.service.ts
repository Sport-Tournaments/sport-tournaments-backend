import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Tournament } from './entities/tournament.entity';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
  TournamentFilterDto,
  AdminUpdateTournamentDto,
} from './dto';
import { PaginationDto } from '../../common/dto';
import { PaginatedResponse } from '../../common/interfaces';
import { TournamentStatus, UserRole } from '../../common/enums';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
  ) {}

  async create(
    organizerId: string,
    createTournamentDto: CreateTournamentDto,
  ): Promise<Tournament> {
    // Validate dates
    const startDate = new Date(createTournamentDto.startDate);
    const endDate = new Date(createTournamentDto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Extract nested DTO arrays to handle separately (not stored in tournament entity)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ageGroups, locations, ...tournamentData } = createTournamentDto;

    const tournament = this.tournamentsRepository.create({
      ...tournamentData,
      organizerId,
      startDate,
      endDate,
      registrationDeadline: createTournamentDto.registrationDeadline
        ? new Date(createTournamentDto.registrationDeadline)
        : undefined,
      status: TournamentStatus.DRAFT,
    });

    return this.tournamentsRepository.save(tournament);
  }

  async findAll(
    pagination: PaginationDto,
    filters?: TournamentFilterDto,
  ): Promise<PaginatedResponse<Tournament>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.tournamentsRepository
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.organizer', 'organizer');

    // By default, only show published tournaments for public queries
    if (!filters?.status) {
      queryBuilder.andWhere('tournament.isPublished = :isPublished', {
        isPublished: true,
      });
    } else {
      queryBuilder.andWhere('tournament.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.ageCategory) {
      queryBuilder.andWhere('tournament.ageCategory = :ageCategory', {
        ageCategory: filters.ageCategory,
      });
    }

    if (filters?.level) {
      queryBuilder.andWhere('tournament.level = :level', {
        level: filters.level,
      });
    }

    if (filters?.country) {
      queryBuilder.andWhere('tournament.country = :country', {
        country: filters.country,
      });
    }

    if (filters?.startDateFrom && filters?.startDateTo) {
      queryBuilder.andWhere(
        'tournament.startDate BETWEEN :startDateFrom AND :startDateTo',
        {
          startDateFrom: filters.startDateFrom,
          startDateTo: filters.startDateTo,
        },
      );
    } else if (filters?.startDateFrom) {
      queryBuilder.andWhere('tournament.startDate >= :startDateFrom', {
        startDateFrom: filters.startDateFrom,
      });
    } else if (filters?.startDateTo) {
      queryBuilder.andWhere('tournament.startDate <= :startDateTo', {
        startDateTo: filters.startDateTo,
      });
    }

    if (filters?.gameSystem) {
      queryBuilder.andWhere('tournament.gameSystem = :gameSystem', {
        gameSystem: filters.gameSystem,
      });
    }

    if (filters?.numberOfMatchesMin) {
      queryBuilder.andWhere('tournament.numberOfMatches >= :minMatches', {
        minMatches: filters.numberOfMatchesMin,
      });
    }

    if (filters?.numberOfMatchesMax) {
      queryBuilder.andWhere('tournament.numberOfMatches <= :maxMatches', {
        maxMatches: filters.numberOfMatchesMax,
      });
    }

    if (filters?.isPremium !== undefined) {
      queryBuilder.andWhere('tournament.isPremium = :isPremium', {
        isPremium: filters.isPremium,
      });
    }

    if (filters?.isFeatured !== undefined) {
      queryBuilder.andWhere('tournament.isFeatured = :isFeatured', {
        isFeatured: filters.isFeatured,
      });
    }

    if (filters?.hasAvailableSpots) {
      queryBuilder.andWhere('tournament.currentTeams < tournament.maxTeams');
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(tournament.name LIKE :search OR tournament.description LIKE :search OR tournament.location LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Distance filter using Haversine formula (approximate)
    // Default to 50km radius when user location is provided but no maxDistance specified
    const hasUserLocation = filters?.userLatitude && filters?.userLongitude;
    const effectiveMaxDistance = filters?.maxDistance ?? (hasUserLocation ? 50 : undefined);

    if (hasUserLocation && effectiveMaxDistance) {
      // Add distance calculation as a select expression for potential sorting
      queryBuilder.addSelect(
        `(
          6371 * acos(
            cos(radians(:userLat)) * cos(radians(tournament.latitude)) *
            cos(radians(tournament.longitude) - radians(:userLng)) +
            sin(radians(:userLat)) * sin(radians(tournament.latitude))
          )
        )`,
        'distance',
      );

      queryBuilder.andWhere(
        `(
          6371 * acos(
            cos(radians(:userLat)) * cos(radians(tournament.latitude)) *
            cos(radians(tournament.longitude) - radians(:userLng)) +
            sin(radians(:userLat)) * sin(radians(tournament.latitude))
          )
        ) <= :maxDistance`,
        {
          userLat: filters.userLatitude,
          userLng: filters.userLongitude,
          maxDistance: effectiveMaxDistance,
        },
      );
    }

    // Sorting
    // If sortByDistance is true and user location is provided, sort by distance first
    if (filters?.sortByDistance && hasUserLocation) {
      queryBuilder.orderBy('distance', 'ASC');
      // Featured tournaments still get priority within distance groups
      queryBuilder.addOrderBy('tournament.isFeatured', 'DESC');
    } else {
      const sortField = filters?.sortBy || 'startDate';
      const sortOrder = filters?.sortOrder || 'ASC';
      const allowedSortFields = [
        'startDate',
        'name',
        'participationFee',
        'maxTeams',
        'createdAt',
        'distance',
      ];

      if (allowedSortFields.includes(sortField)) {
        if (sortField === 'distance' && hasUserLocation) {
          queryBuilder.orderBy('distance', sortOrder);
        } else if (sortField !== 'distance') {
          queryBuilder.orderBy(`tournament.${sortField}`, sortOrder);
        } else {
          queryBuilder.orderBy('tournament.startDate', 'ASC');
        }
      } else {
        queryBuilder.orderBy('tournament.startDate', 'ASC');
      }

      // Featured tournaments first (unless sorting by distance)
      queryBuilder.addOrderBy('tournament.isFeatured', 'DESC');
    }

    const [tournaments, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: tournaments,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string): Promise<Tournament | null> {
    return this.tournamentsRepository.findOne({
      where: { id },
      relations: ['organizer', 'registrations', 'groups'],
    });
  }

  async findByIdOrFail(id: string): Promise<Tournament> {
    const tournament = await this.findById(id);

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${id} not found`);
    }

    return tournament;
  }

  async findByOrganizer(organizerId: string): Promise<Tournament[]> {
    return this.tournamentsRepository.find({
      where: { organizerId },
      order: { startDate: 'DESC' },
    });
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateTournamentDto: UpdateTournamentDto,
  ): Promise<Tournament> {
    const tournament = await this.findByIdOrFail(id);

    // Only the organizer or admin can update the tournament
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to update this tournament',
      );
    }

    // Cannot update completed or cancelled tournaments
    if (
      tournament.status === TournamentStatus.COMPLETED ||
      tournament.status === TournamentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot update a completed or cancelled tournament',
      );
    }

    // Validate dates if being updated
    if (updateTournamentDto.startDate || updateTournamentDto.endDate) {
      const startDate = updateTournamentDto.startDate
        ? new Date(updateTournamentDto.startDate)
        : tournament.startDate;
      const endDate = updateTournamentDto.endDate
        ? new Date(updateTournamentDto.endDate)
        : tournament.endDate;

      if (endDate < startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    Object.assign(tournament, {
      ...updateTournamentDto,
      startDate: updateTournamentDto.startDate
        ? new Date(updateTournamentDto.startDate)
        : tournament.startDate,
      endDate: updateTournamentDto.endDate
        ? new Date(updateTournamentDto.endDate)
        : tournament.endDate,
      registrationDeadline: updateTournamentDto.registrationDeadline
        ? new Date(updateTournamentDto.registrationDeadline)
        : tournament.registrationDeadline,
    });

    return this.tournamentsRepository.save(tournament);
  }

  async adminUpdate(
    id: string,
    adminUpdateTournamentDto: AdminUpdateTournamentDto,
  ): Promise<Tournament> {
    const tournament = await this.findByIdOrFail(id);

    Object.assign(tournament, adminUpdateTournamentDto);

    return this.tournamentsRepository.save(tournament);
  }

  async publish(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<Tournament> {
    const tournament = await this.findByIdOrFail(id);

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to publish this tournament',
      );
    }

    if (tournament.status !== TournamentStatus.DRAFT) {
      throw new BadRequestException('Only draft tournaments can be published');
    }

    tournament.status = TournamentStatus.PUBLISHED;
    tournament.isPublished = true;

    return this.tournamentsRepository.save(tournament);
  }

  async cancel(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<Tournament> {
    const tournament = await this.findByIdOrFail(id);

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to cancel this tournament',
      );
    }

    if (tournament.status === TournamentStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed tournament');
    }

    tournament.status = TournamentStatus.CANCELLED;

    return this.tournamentsRepository.save(tournament);
  }

  async start(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<Tournament> {
    const tournament = await this.findByIdOrFail(id);

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to start this tournament',
      );
    }

    if (tournament.status !== TournamentStatus.PUBLISHED) {
      throw new BadRequestException(
        'Only published tournaments can be started',
      );
    }

    tournament.status = TournamentStatus.ONGOING;

    return this.tournamentsRepository.save(tournament);
  }

  async complete(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<Tournament> {
    const tournament = await this.findByIdOrFail(id);

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to complete this tournament',
      );
    }

    if (tournament.status !== TournamentStatus.ONGOING) {
      throw new BadRequestException(
        'Only ongoing tournaments can be completed',
      );
    }

    tournament.status = TournamentStatus.COMPLETED;

    return this.tournamentsRepository.save(tournament);
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const tournament = await this.findByIdOrFail(id);

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to delete this tournament',
      );
    }

    // Only allow deletion of draft or cancelled tournaments
    if (
      tournament.status !== TournamentStatus.DRAFT &&
      tournament.status !== TournamentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only draft or cancelled tournaments can be deleted',
      );
    }

    await this.tournamentsRepository.remove(tournament);
  }

  async incrementRegulationsDownload(id: string): Promise<void> {
    await this.tournamentsRepository.increment(
      { id },
      'regulationsDownloadCount',
      1,
    );
  }

  async getStatistics(): Promise<{
    totalTournaments: number;
    publishedTournaments: number;
    ongoingTournaments: number;
    completedTournaments: number;
    tournamentsByStatus: Record<string, number>;
    tournamentsByAgeCategory: Record<string, number>;
    tournamentsByCountry: Record<string, number>;
    upcomingTournaments: number;
  }> {
    const totalTournaments = await this.tournamentsRepository.count();
    const publishedTournaments = await this.tournamentsRepository.count({
      where: { status: TournamentStatus.PUBLISHED },
    });
    const ongoingTournaments = await this.tournamentsRepository.count({
      where: { status: TournamentStatus.ONGOING },
    });
    const completedTournaments = await this.tournamentsRepository.count({
      where: { status: TournamentStatus.COMPLETED },
    });

    const upcomingTournaments = await this.tournamentsRepository.count({
      where: {
        status: TournamentStatus.PUBLISHED,
        startDate: MoreThanOrEqual(new Date()),
      },
    });

    const statusStats = await this.tournamentsRepository
      .createQueryBuilder('tournament')
      .select('tournament.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tournament.status')
      .getRawMany();

    const ageCategoryStats = await this.tournamentsRepository
      .createQueryBuilder('tournament')
      .select('tournament.ageCategory', 'ageCategory')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tournament.ageCategory')
      .getRawMany();

    const countryStats = await this.tournamentsRepository
      .createQueryBuilder('tournament')
      .select('tournament.country', 'country')
      .addSelect('COUNT(*)', 'count')
      .where('tournament.country IS NOT NULL')
      .groupBy('tournament.country')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalTournaments,
      publishedTournaments,
      ongoingTournaments,
      completedTournaments,
      upcomingTournaments,
      tournamentsByStatus: statusStats.reduce(
        (acc, item) => ({ ...acc, [item.status]: parseInt(item.count, 10) }),
        {},
      ),
      tournamentsByAgeCategory: ageCategoryStats.reduce(
        (acc, item) => ({
          ...acc,
          [item.ageCategory]: parseInt(item.count, 10),
        }),
        {},
      ),
      tournamentsByCountry: countryStats.reduce(
        (acc, item) => ({ ...acc, [item.country]: parseInt(item.count, 10) }),
        {},
      ),
    };
  }

  async getFeaturedTournaments(limit: number = 6): Promise<Tournament[]> {
    return this.tournamentsRepository.find({
      where: {
        isPublished: true,
        isFeatured: true,
        status: TournamentStatus.PUBLISHED,
        startDate: MoreThanOrEqual(new Date()),
      },
      relations: ['organizer'],
      order: { startDate: 'ASC' },
      take: limit,
    });
  }

  async getUpcomingTournaments(limit: number = 10): Promise<Tournament[]> {
    return this.tournamentsRepository.find({
      where: {
        isPublished: true,
        status: TournamentStatus.PUBLISHED,
        startDate: MoreThanOrEqual(new Date()),
      },
      relations: ['organizer'],
      order: { startDate: 'ASC' },
      take: limit,
    });
  }

  /**
   * Generate a unique invitation code for a private tournament
   */
  generateInvitationCode(): string {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (O, 0, 1, I)
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  /**
   * Regenerate invitation code for a private tournament
   */
  async regenerateInvitationCode(
    id: string,
    userId: string,
    userRole: string,
    expiresInDays?: number,
  ): Promise<{ invitationCode: string; expiresAt: Date | null }> {
    const tournament = await this.findByIdOrFail(id);

    // Check authorization
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the tournament organizer can regenerate invitation codes');
    }

    if (!tournament.isPrivate) {
      throw new BadRequestException('Invitation codes are only available for private tournaments');
    }

    // Generate new unique code
    let code: string;
    let attempts = 0;
    do {
      code = this.generateInvitationCode();
      const existing = await this.tournamentsRepository.findOne({
        where: { invitationCode: code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new BadRequestException('Failed to generate unique invitation code. Please try again.');
    }

    // Calculate expiration date
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    tournament.invitationCode = code;
    tournament.invitationCodeExpiresAt = expiresAt;
    await this.tournamentsRepository.save(tournament);

    return { invitationCode: code, expiresAt: expiresAt || null };
  }

  /**
   * Validate an invitation code
   */
  async validateInvitationCode(code: string): Promise<{
    valid: boolean;
    tournament?: Tournament;
    message?: string;
  }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { invitationCode: code },
      relations: ['organizer'],
    });

    if (!tournament) {
      return { valid: false, message: 'Invalid invitation code' };
    }

    // Check if code has expired
    if (tournament.invitationCodeExpiresAt && tournament.invitationCodeExpiresAt < new Date()) {
      return { valid: false, message: 'Invitation code has expired' };
    }

    // Check if tournament is still accepting registrations
    if (tournament.status === TournamentStatus.CANCELLED) {
      return { valid: false, message: 'Tournament has been cancelled' };
    }

    if (tournament.status === TournamentStatus.COMPLETED) {
      return { valid: false, message: 'Tournament has already ended' };
    }

    if (tournament.registrationDeadline && tournament.registrationDeadline < new Date()) {
      return { valid: false, message: 'Registration deadline has passed' };
    }

    return { valid: true, tournament };
  }

  /**
   * Get invitation code for a tournament (only organizer/admin can see)
   */
  async getInvitationCode(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<{ invitationCode: string | null; expiresAt: Date | null }> {
    const tournament = await this.findByIdOrFail(id);

    // Check authorization
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the tournament organizer can view invitation codes');
    }

    return {
      invitationCode: tournament.invitationCode || null,
      expiresAt: tournament.invitationCodeExpiresAt || null,
    };
  }
}
