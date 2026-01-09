import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  TournamentInvitation,
  InvitationStatus,
  InvitationType,
} from './entities/invitation.entity';
import {
  CreateInvitationDto,
  BulkInvitationDto,
  RespondToInvitationDto,
  InvitationFilterDto,
  InvitePartnerTeamsDto,
  InvitePastParticipantsDto,
} from './dto';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Club } from '../clubs/entities/club.entity';
import { UserRole } from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(TournamentInvitation)
    private invitationsRepository: Repository<TournamentInvitation>,
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Club)
    private clubsRepository: Repository<Club>,
    private notificationsService: NotificationsService,
  ) {}

  private generateInvitationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getDefaultExpiration(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 30); // 30 days from now
    return date;
  }

  async create(
    dto: CreateInvitationDto,
    userId: string,
    userRole: string,
  ): Promise<TournamentInvitation> {
    // Validate tournament exists and user has permission
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: dto.tournamentId },
      relations: ['organizer'],
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with ID ${dto.tournamentId} not found`,
      );
    }

    // Only organizer or admin can send invitations
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You can only send invitations for your own tournaments',
      );
    }

    // Validate club if provided
    let club: Club | null = null;
    if (dto.clubId) {
      club = await this.clubsRepository.findOne({ where: { id: dto.clubId } });
      if (!club) {
        throw new NotFoundException(`Club with ID ${dto.clubId} not found`);
      }
    }

    // Check for duplicate invitation
    const existingInvitation = await this.invitationsRepository.findOne({
      where: dto.clubId
        ? { tournamentId: dto.tournamentId, clubId: dto.clubId }
        : { tournamentId: dto.tournamentId, email: dto.email },
    });

    if (
      existingInvitation &&
      existingInvitation.status === InvitationStatus.PENDING
    ) {
      throw new ConflictException(
        'An invitation already exists for this recipient',
      );
    }

    const invitation = this.invitationsRepository.create({
      tournamentId: dto.tournamentId,
      clubId: dto.clubId,
      email: dto.email || club?.contactEmail,
      type: dto.type || InvitationType.DIRECT,
      message: dto.message,
      expiresAt: dto.expiresAt
        ? new Date(dto.expiresAt)
        : this.getDefaultExpiration(),
      invitationToken: this.generateInvitationToken(),
    });

    const savedInvitation = await this.invitationsRepository.save(invitation);

    // Send notification to club owner if club invitation
    if (club) {
      await this.notificationsService.create({
        userId: club.organizerId,
        type: NotificationType.TOURNAMENT_UPDATE,
        title: 'Tournament Invitation',
        message: `You've been invited to participate in ${tournament.name}`,
        relatedTournamentId: tournament.id,
        sendEmailNotification: true,
      });

      savedInvitation.emailSentAt = new Date();
      await this.invitationsRepository.save(savedInvitation);
    }

    // TODO: Send email invitation if email-based

    return savedInvitation;
  }

  async createBulk(
    dto: BulkInvitationDto,
    userId: string,
    userRole: string,
  ): Promise<{
    created: number;
    skipped: number;
    invitations: TournamentInvitation[];
  }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: dto.tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with ID ${dto.tournamentId} not found`,
      );
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You can only send invitations for your own tournaments',
      );
    }

    const invitations: TournamentInvitation[] = [];
    let skipped = 0;

    // Process club IDs
    if (dto.clubIds && dto.clubIds.length > 0) {
      const clubs = await this.clubsRepository.find({
        where: { id: In(dto.clubIds) },
      });

      for (const club of clubs) {
        // Check for existing invitation
        const existing = await this.invitationsRepository.findOne({
          where: { tournamentId: dto.tournamentId, clubId: club.id },
        });

        if (existing && existing.status === InvitationStatus.PENDING) {
          skipped++;
          continue;
        }

        const invitation = this.invitationsRepository.create({
          tournamentId: dto.tournamentId,
          clubId: club.id,
          email: club.contactEmail,
          type: dto.type || InvitationType.DIRECT,
          message: dto.message,
          expiresAt: dto.expiresAt
            ? new Date(dto.expiresAt)
            : this.getDefaultExpiration(),
          invitationToken: this.generateInvitationToken(),
        });

        invitations.push(invitation);
      }
    }

    // Process emails
    if (dto.emails && dto.emails.length > 0) {
      for (const email of dto.emails) {
        const existing = await this.invitationsRepository.findOne({
          where: { tournamentId: dto.tournamentId, email },
        });

        if (existing && existing.status === InvitationStatus.PENDING) {
          skipped++;
          continue;
        }

        const invitation = this.invitationsRepository.create({
          tournamentId: dto.tournamentId,
          email,
          type: InvitationType.EMAIL,
          message: dto.message,
          expiresAt: dto.expiresAt
            ? new Date(dto.expiresAt)
            : this.getDefaultExpiration(),
          invitationToken: this.generateInvitationToken(),
        });

        invitations.push(invitation);
      }
    }

    const savedInvitations = await this.invitationsRepository.save(invitations);

    return {
      created: savedInvitations.length,
      skipped,
      invitations: savedInvitations,
    };
  }

  async invitePartnerTeams(
    dto: InvitePartnerTeamsDto,
    userId: string,
    userRole: string,
  ): Promise<{ created: number; skipped: number }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: dto.tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with ID ${dto.tournamentId} not found`,
      );
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You can only send invitations for your own tournaments',
      );
    }

    // Get partner teams from visibility settings
    const visibilitySettings = tournament.visibilitySettings as {
      partnerTeams?: string[];
    } | null;

    const partnerClubIds = visibilitySettings?.partnerTeams || [];

    if (partnerClubIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const result = await this.createBulk(
      {
        tournamentId: dto.tournamentId,
        clubIds: partnerClubIds,
        message: dto.message,
        type: InvitationType.PARTNER,
      },
      userId,
      userRole,
    );

    return { created: result.created, skipped: result.skipped };
  }

  async invitePastParticipants(
    dto: InvitePastParticipantsDto,
    userId: string,
    userRole: string,
  ): Promise<{ created: number; skipped: number }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: dto.tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with ID ${dto.tournamentId} not found`,
      );
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You can only send invitations for your own tournaments',
      );
    }

    // Get past participants from visibility settings
    const visibilitySettings = tournament.visibilitySettings as {
      pastParticipants?: string[];
    } | null;

    const pastParticipantIds = visibilitySettings?.pastParticipants || [];

    if (pastParticipantIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const result = await this.createBulk(
      {
        tournamentId: dto.tournamentId,
        clubIds: pastParticipantIds,
        message: dto.message,
        type: InvitationType.PAST_PARTICIPANT,
      },
      userId,
      userRole,
    );

    return { created: result.created, skipped: result.skipped };
  }

  async findByTournament(
    tournamentId: string,
    userId: string,
    userRole: string,
    filters?: InvitationFilterDto,
  ): Promise<TournamentInvitation[]> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with ID ${tournamentId} not found`,
      );
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You can only view invitations for your own tournaments',
      );
    }

    const queryBuilder = this.invitationsRepository
      .createQueryBuilder('invitation')
      .leftJoinAndSelect('invitation.club', 'club')
      .where('invitation.tournamentId = :tournamentId', { tournamentId });

    if (filters?.status) {
      queryBuilder.andWhere('invitation.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.type) {
      queryBuilder.andWhere('invitation.type = :type', { type: filters.type });
    }

    return queryBuilder.orderBy('invitation.createdAt', 'DESC').getMany();
  }

  async findByClub(
    clubId: string,
    userId: string,
  ): Promise<TournamentInvitation[]> {
    const club = await this.clubsRepository.findOne({ where: { id: clubId } });

    if (!club) {
      throw new NotFoundException(`Club with ID ${clubId} not found`);
    }

    if (club.organizerId !== userId) {
      throw new ForbiddenException(
        'You can only view invitations for your own clubs',
      );
    }

    return this.invitationsRepository.find({
      where: { clubId, status: InvitationStatus.PENDING },
      relations: ['tournament'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByToken(token: string): Promise<TournamentInvitation> {
    const invitation = await this.invitationsRepository.findOne({
      where: { invitationToken: token },
      relations: ['tournament', 'club'],
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation token');
    }

    // Check if expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationsRepository.save(invitation);
      throw new BadRequestException('This invitation has expired');
    }

    return invitation;
  }

  async respond(
    invitationId: string,
    dto: RespondToInvitationDto,
    userId: string,
  ): Promise<TournamentInvitation> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
      relations: ['club', 'tournament'],
    });

    if (!invitation) {
      throw new NotFoundException(
        `Invitation with ID ${invitationId} not found`,
      );
    }

    // Verify the user owns the invited club
    if (invitation.clubId) {
      const club = await this.clubsRepository.findOne({
        where: { id: invitation.clubId },
      });

      if (!club || club.organizerId !== userId) {
        throw new ForbiddenException(
          'You can only respond to invitations for your own clubs',
        );
      }
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'This invitation has already been responded to',
      );
    }

    // Check expiration
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationsRepository.save(invitation);
      throw new BadRequestException('This invitation has expired');
    }

    invitation.status =
      dto.response === 'ACCEPTED'
        ? InvitationStatus.ACCEPTED
        : InvitationStatus.DECLINED;
    invitation.respondedAt = new Date();
    invitation.responseMessage = dto.responseMessage;

    const savedInvitation = await this.invitationsRepository.save(invitation);

    // Notify tournament organizer
    if (invitation.tournament) {
      await this.notificationsService.create({
        userId: invitation.tournament.organizerId,
        type: NotificationType.TOURNAMENT_UPDATE,
        title: 'Invitation Response',
        message: `${invitation.club?.name || invitation.email} has ${dto.response.toLowerCase()} your invitation to ${invitation.tournament.name}`,
        relatedTournamentId: invitation.tournamentId,
        sendEmailNotification: true,
      });
    }

    return savedInvitation;
  }

  async respondByToken(
    token: string,
    dto: RespondToInvitationDto,
  ): Promise<TournamentInvitation> {
    const invitation = await this.findByToken(token);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'This invitation has already been responded to',
      );
    }

    invitation.status =
      dto.response === 'ACCEPTED'
        ? InvitationStatus.ACCEPTED
        : InvitationStatus.DECLINED;
    invitation.respondedAt = new Date();
    invitation.responseMessage = dto.responseMessage;

    return this.invitationsRepository.save(invitation);
  }

  async resendInvitation(
    invitationId: string,
    userId: string,
    userRole: string,
  ): Promise<TournamentInvitation> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
      relations: ['tournament'],
    });

    if (!invitation) {
      throw new NotFoundException(
        `Invitation with ID ${invitationId} not found`,
      );
    }

    if (
      invitation.tournament?.organizerId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You can only resend invitations for your own tournaments',
      );
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only resend pending invitations');
    }

    // Reset token and extend expiration
    invitation.invitationToken = this.generateInvitationToken();
    invitation.expiresAt = this.getDefaultExpiration();
    invitation.reminderSentAt = new Date();
    invitation.reminderCount = (invitation.reminderCount || 0) + 1;

    // TODO: Actually send the email

    return this.invitationsRepository.save(invitation);
  }

  async cancel(
    invitationId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
      relations: ['tournament'],
    });

    if (!invitation) {
      throw new NotFoundException(
        `Invitation with ID ${invitationId} not found`,
      );
    }

    if (
      invitation.tournament?.organizerId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You can only cancel invitations for your own tournaments',
      );
    }

    await this.invitationsRepository.remove(invitation);
  }

  async getInvitationStats(
    tournamentId: string,
    userId: string,
    userRole: string,
  ): Promise<{
    total: number;
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
  }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with ID ${tournamentId} not found`,
      );
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You can only view stats for your own tournaments',
      );
    }

    const stats = await this.invitationsRepository
      .createQueryBuilder('invitation')
      .select('invitation.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('invitation.tournamentId = :tournamentId', { tournamentId })
      .groupBy('invitation.status')
      .getRawMany();

    const result = {
      total: 0,
      pending: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
    };

    for (const stat of stats) {
      const count = parseInt(stat.count, 10);
      result.total += count;
      switch (stat.status) {
        case InvitationStatus.PENDING:
          result.pending = count;
          break;
        case InvitationStatus.ACCEPTED:
          result.accepted = count;
          break;
        case InvitationStatus.DECLINED:
          result.declined = count;
          break;
        case InvitationStatus.EXPIRED:
          result.expired = count;
          break;
      }
    }

    return result;
  }
}
