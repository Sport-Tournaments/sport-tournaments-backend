import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvitationsService } from './invitations.service';
import {
  TournamentInvitation,
  InvitationStatus,
  InvitationType,
} from './entities/invitation.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Club } from '../clubs/entities/club.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateInvitationDto,
  BulkInvitationDto,
  RespondToInvitationDto,
} from './dto';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, TournamentStatus } from '../../common/enums';

describe('InvitationsService', () => {
  let service: InvitationsService;

  const mockTournament: Partial<Tournament> = {
    id: 'tournament-1',
    name: 'Test Tournament',
    status: TournamentStatus.PUBLISHED,
    organizerId: 'organizer-1',
  };

  const mockClub: Partial<Club> = {
    id: 'club-1',
    name: 'Test FC',
    organizerId: 'club-owner-1',
    contactEmail: 'club@test.com',
  };

  const mockInvitation: Partial<TournamentInvitation> = {
    id: 'invitation-1',
    tournamentId: 'tournament-1',
    clubId: 'club-1',
    email: 'club@test.com',
    type: InvitationType.DIRECT,
    status: InvitationStatus.PENDING,
    invitationToken: 'token123',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  const mockInvitationsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockInvitation], 1]),
      getMany: jest.fn().mockResolvedValue([mockInvitation]),
    })),
  };

  const mockTournamentsRepo = {
    findOne: jest.fn(),
  };

  const mockClubsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        {
          provide: getRepositoryToken(TournamentInvitation),
          useValue: mockInvitationsRepo,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentsRepo,
        },
        {
          provide: getRepositoryToken(Club),
          useValue: mockClubsRepo,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateInvitationDto = {
      tournamentId: 'tournament-1',
      clubId: 'club-1',
      message: 'You are invited!',
    };

    it('should create an invitation successfully', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockInvitationsRepo.findOne.mockResolvedValue(null);
      mockInvitationsRepo.create.mockReturnValue(mockInvitation);
      mockInvitationsRepo.save.mockResolvedValue(mockInvitation);

      const result = await service.create(
        createDto,
        'organizer-1',
        UserRole.ORGANIZER,
      );

      expect(result).toBeDefined();
      expect(mockInvitationsRepo.create).toHaveBeenCalled();
      expect(mockNotificationsService.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(createDto, 'organizer-1', UserRole.ORGANIZER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not tournament organizer', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.create(createDto, 'other-user', UserRole.ORGANIZER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to create invitation for any tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockInvitationsRepo.findOne.mockResolvedValue(null);
      mockInvitationsRepo.create.mockReturnValue(mockInvitation);
      mockInvitationsRepo.save.mockResolvedValue(mockInvitation);

      const result = await service.create(createDto, 'admin', UserRole.ADMIN);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if club not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(createDto, 'organizer-1', UserRole.ORGANIZER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if pending invitation already exists', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockInvitationsRepo.findOne.mockResolvedValue(mockInvitation);

      await expect(
        service.create(createDto, 'organizer-1', UserRole.ORGANIZER),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createBulk', () => {
    const bulkDto: BulkInvitationDto = {
      tournamentId: 'tournament-1',
      clubIds: ['club-1', 'club-2'],
      message: 'Bulk invitation',
    };

    it('should create bulk invitations successfully', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.find.mockResolvedValue([
        mockClub,
        { ...mockClub, id: 'club-2', contactEmail: 'club2@test.com' },
      ]);
      mockInvitationsRepo.findOne.mockResolvedValue(null);
      mockInvitationsRepo.create.mockImplementation(
        (data: Partial<TournamentInvitation>) => data,
      );
      mockInvitationsRepo.save.mockImplementation(
        (
          invitations: Partial<TournamentInvitation>[],
        ): Partial<TournamentInvitation>[] => invitations,
      );

      const result = await service.createBulk(
        bulkDto,
        'organizer-1',
        UserRole.ORGANIZER,
      );

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.invitations).toHaveLength(2);
    });

    it('should skip existing pending invitations', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.find.mockResolvedValue([mockClub]);
      mockInvitationsRepo.findOne.mockResolvedValue(mockInvitation);
      mockInvitationsRepo.save.mockResolvedValue([]);

      const result = await service.createBulk(
        { ...bulkDto, clubIds: ['club-1'] },
        'organizer-1',
        UserRole.ORGANIZER,
      );

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createBulk(bulkDto, 'organizer-1', UserRole.ORGANIZER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByTournament', () => {
    it('should return invitations for a tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);

      const result = await service.findByTournament(
        'tournament-1',
        'organizer-1',
        UserRole.ORGANIZER,
        {},
      );

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByTournament(
          'tournament-1',
          'organizer-1',
          UserRole.ORGANIZER,
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not tournament organizer', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.findByTournament(
          'tournament-1',
          'other-user',
          UserRole.ORGANIZER,
          {},
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByToken', () => {
    it('should return an invitation by token', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue(mockInvitation);

      const result = await service.findByToken('token123');

      expect(result).toEqual(mockInvitation);
    });

    it('should throw NotFoundException if token invalid', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue(null);

      await expect(service.findByToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('respond', () => {
    const respondDto: RespondToInvitationDto = {
      response: 'ACCEPTED',
    };

    it('should accept an invitation', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        club: mockClub,
        tournament: mockTournament,
      });
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockInvitationsRepo.save.mockResolvedValue({
        ...mockInvitation,
        status: InvitationStatus.ACCEPTED,
      });

      const result = await service.respond(
        'invitation-1',
        respondDto,
        'club-owner-1',
      );

      expect(result.status).toBe(InvitationStatus.ACCEPTED);
    });

    it('should decline an invitation', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        club: mockClub,
        tournament: mockTournament,
      });
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockInvitationsRepo.save.mockResolvedValue({
        ...mockInvitation,
        status: InvitationStatus.DECLINED,
      });

      const result = await service.respond(
        'invitation-1',
        { response: 'DECLINED', responseMessage: 'Not interested' },
        'club-owner-1',
      );

      expect(result.status).toBe(InvitationStatus.DECLINED);
    });

    it('should throw ForbiddenException if user does not own the club', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        club: mockClub,
        tournament: mockTournament,
      });
      mockClubsRepo.findOne.mockResolvedValue({
        ...mockClub,
        organizerId: 'other-user',
      });

      await expect(
        service.respond('invitation-1', respondDto, 'club-owner-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if invitation expired', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        club: mockClub,
        tournament: mockTournament,
        expiresAt: new Date(Date.now() - 1000),
      });
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockInvitationsRepo.save.mockResolvedValue({
        ...mockInvitation,
        status: InvitationStatus.EXPIRED,
      });

      await expect(
        service.respond('invitation-1', respondDto, 'club-owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if invitation not pending', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        club: mockClub,
        tournament: mockTournament,
        status: InvitationStatus.ACCEPTED,
      });
      mockClubsRepo.findOne.mockResolvedValue(mockClub);

      await expect(
        service.respond('invitation-1', respondDto, 'club-owner-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel an invitation', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        tournament: mockTournament,
      });
      mockInvitationsRepo.remove.mockResolvedValue(mockInvitation);

      await service.cancel('invitation-1', 'organizer-1', UserRole.ORGANIZER);

      expect(mockInvitationsRepo.remove).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not tournament organizer', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        tournament: mockTournament,
      });

      await expect(
        service.cancel('invitation-1', 'other-user', UserRole.ORGANIZER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to cancel any invitation', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        tournament: mockTournament,
      });
      mockInvitationsRepo.remove.mockResolvedValue(mockInvitation);

      await service.cancel('invitation-1', 'admin', UserRole.ADMIN);

      expect(mockInvitationsRepo.remove).toHaveBeenCalled();
    });
  });

  describe('resendInvitation', () => {
    it('should resend an invitation', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        tournament: mockTournament,
      });
      mockInvitationsRepo.save.mockResolvedValue(mockInvitation);

      const result = await service.resendInvitation(
        'invitation-1',
        'organizer-1',
        UserRole.ORGANIZER,
      );

      expect(result).toBeDefined();
      expect(mockInvitationsRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not tournament organizer', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        tournament: mockTournament,
      });

      await expect(
        service.resendInvitation(
          'invitation-1',
          'other-user',
          UserRole.ORGANIZER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if invitation not pending', async () => {
      mockInvitationsRepo.findOne.mockResolvedValue({
        ...mockInvitation,
        tournament: mockTournament,
        status: InvitationStatus.ACCEPTED,
      });

      await expect(
        service.resendInvitation(
          'invitation-1',
          'organizer-1',
          UserRole.ORGANIZER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
