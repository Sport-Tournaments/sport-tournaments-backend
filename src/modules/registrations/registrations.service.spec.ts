import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RegistrationsService } from './registrations.service';
import { Registration } from './entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Club } from '../clubs/entities/club.entity';
import { CreateRegistrationDto } from './dto';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  RegistrationStatus,
  TournamentStatus,
  UserRole,
  PaymentStatus,
} from '../../common/enums';

describe('RegistrationsService', () => {
  let service: RegistrationsService;

  const mockTournament: Partial<Tournament> = {
    id: 'tournament-1',
    name: 'Test Tournament',
    status: TournamentStatus.PUBLISHED,
    maxTeams: 16,
    currentTeams: 10,
    participationFee: 200,
    registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    organizerId: 'organizer-1',
  };

  const mockClub: Partial<Club> = {
    id: 'club-1',
    name: 'Test FC',
    organizerId: 'user-1',
  };

  const mockRegistration: Partial<Registration> = {
    id: 'registration-1',
    tournamentId: 'tournament-1',
    clubId: 'club-1',
    status: RegistrationStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    registrationDate: new Date(),
    club: mockClub as Club,
    tournament: mockTournament as Tournament,
  };

  const createMockQueryBuilder = () => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockRegistration], 1]),
    getOne: jest.fn().mockResolvedValue(mockRegistration),
  });

  const mockRegistrationsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockTournamentsRepo = {
    findOne: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  };

  const mockClubsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        {
          provide: getRepositoryToken(Registration),
          useValue: mockRegistrationsRepo,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentsRepo,
        },
        {
          provide: getRepositoryToken(Club),
          useValue: mockClubsRepo,
        },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateRegistrationDto = {
      clubId: 'club-1',
      teamName: 'Test Team',
      coachName: 'John Coach',
      coachEmail: 'coach@test.com',
      coachPhone: '+40123456789',
    };

    it('should create a registration successfully', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockRegistrationsRepo.findOne.mockResolvedValue(null); // No existing registration
      mockRegistrationsRepo.create.mockReturnValue(mockRegistration);
      mockRegistrationsRepo.save.mockResolvedValue(mockRegistration);
      mockTournamentsRepo.increment.mockResolvedValue({ affected: 1 });

      const result = await service.create('tournament-1', 'user-1', createDto);

      expect(result).toBeDefined();
      expect(mockRegistrationsRepo.save).toHaveBeenCalled();
      expect(mockTournamentsRepo.increment).toHaveBeenCalled();
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('non-existent', 'user-1', createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if tournament is not accepting registrations', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.DRAFT,
      });

      await expect(
        service.create('tournament-1', 'user-1', createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if registration deadline has passed', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        registrationDeadline: new Date(Date.now() - 1000),
      });

      await expect(
        service.create('tournament-1', 'user-1', createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if tournament is full', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        currentTeams: 16,
        maxTeams: 16,
      });

      await expect(
        service.create('tournament-1', 'user-1', createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if club not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tournament-1', 'user-1', createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the club', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.findOne.mockResolvedValue({
        ...mockClub,
        organizerId: 'other-user',
      });

      await expect(
        service.create('tournament-1', 'user-1', createDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if club is already registered', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);

      await expect(
        service.create('tournament-1', 'user-1', createDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByTournament', () => {
    it('should return paginated registrations for a tournament', async () => {
      const pagination = { page: 1, pageSize: 20 };

      const result = await service.findByTournament('tournament-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply status filter', async () => {
      const pagination = { page: 1, pageSize: 20 };
      const filters = { status: RegistrationStatus.APPROVED };

      await service.findByTournament('tournament-1', pagination, filters);

      expect(mockRegistrationsRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a registration by id', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);

      const result = await service.findById('registration-1');

      expect(result).toEqual(mockRegistration);
    });

    it('should return null if registration not found', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return a registration by id', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);

      const result = await service.findByIdOrFail('registration-1');

      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException if registration not found', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByClub', () => {
    it('should return registrations for a club', async () => {
      mockRegistrationsRepo.find.mockResolvedValue([mockRegistration]);

      const result = await service.findByClub('club-1');

      expect(result).toHaveLength(1);
      expect(mockRegistrationsRepo.find).toHaveBeenCalledWith({
        where: { clubId: 'club-1' },
        relations: ['tournament'],
        order: { registrationDate: 'DESC' },
      });
    });
  });

  describe('approve', () => {
    it('should approve a pending registration', async () => {
      const pendingRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.PENDING,
      };
      mockRegistrationsRepo.findOne.mockResolvedValue(pendingRegistration);
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationsRepo.save.mockResolvedValue({
        ...pendingRegistration,
        status: RegistrationStatus.APPROVED,
      });

      const result = await service.approve(
        'registration-1',
        'organizer-1',
        UserRole.ORGANIZER,
      );

      expect(result.status).toBe(RegistrationStatus.APPROVED);
    });

    it('should throw ForbiddenException if user is not tournament organizer', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.approve('registration-1', 'other-user', UserRole.ORGANIZER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to approve any registration', async () => {
      const pendingRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.PENDING,
      };
      mockRegistrationsRepo.findOne.mockResolvedValue(pendingRegistration);
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationsRepo.save.mockResolvedValue({
        ...pendingRegistration,
        status: RegistrationStatus.APPROVED,
      });

      const result = await service.approve(
        'registration-1',
        'admin-user',
        UserRole.ADMIN,
      );

      expect(result.status).toBe(RegistrationStatus.APPROVED);
    });
  });

  describe('reject', () => {
    it('should reject a pending registration', async () => {
      const pendingRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.PENDING,
      };
      mockRegistrationsRepo.findOne.mockResolvedValue(pendingRegistration);
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationsRepo.save.mockResolvedValue({
        ...pendingRegistration,
        status: RegistrationStatus.REJECTED,
      });
      mockTournamentsRepo.decrement.mockResolvedValue({ affected: 1 });

      const result = await service.reject(
        'registration-1',
        'organizer-1',
        UserRole.ORGANIZER,
        'Team does not meet requirements',
      );

      expect(result.status).toBe(RegistrationStatus.REJECTED);
    });
  });

  describe('withdraw', () => {
    it('should allow club owner to withdraw registration', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);
      mockClubsRepo.findOne.mockResolvedValue(mockClub);
      mockRegistrationsRepo.save.mockResolvedValue({
        ...mockRegistration,
        status: RegistrationStatus.WITHDRAWN,
      });
      mockTournamentsRepo.decrement.mockResolvedValue({ affected: 1 });

      const result = await service.withdraw(
        'registration-1',
        'user-1',
        UserRole.ORGANIZER,
      );

      expect(result.status).toBe(RegistrationStatus.WITHDRAWN);
    });

    it('should throw ForbiddenException if user does not own the club', async () => {
      mockRegistrationsRepo.findOne.mockResolvedValue(mockRegistration);
      mockClubsRepo.findOne.mockResolvedValue({
        ...mockClub,
        organizerId: 'other-user',
      });

      await expect(
        service.withdraw('registration-1', 'user-1', UserRole.ORGANIZER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to withdraw any registration', async () => {
      const pendingRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.PENDING,
      };
      mockRegistrationsRepo.findOne.mockResolvedValue(pendingRegistration);
      mockClubsRepo.findOne.mockResolvedValue({
        ...mockClub,
        organizerId: 'other-user',
      });
      mockRegistrationsRepo.save.mockResolvedValue({
        ...pendingRegistration,
        status: RegistrationStatus.WITHDRAWN,
      });
      mockTournamentsRepo.decrement.mockResolvedValue({ affected: 1 });

      const result = await service.withdraw(
        'registration-1',
        'admin',
        UserRole.ADMIN,
      );

      expect(result.status).toBe(RegistrationStatus.WITHDRAWN);
    });
  });
});
