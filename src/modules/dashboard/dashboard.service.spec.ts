import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole, RegistrationStatus } from '../../common/enums';
import { Club } from '../clubs/entities/club.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { DashboardService } from './dashboard.service';

const createRegistrationQueryBuilder = (
  recentRegistrations: Partial<Registration>[],
  statsRows: Array<{ status: RegistrationStatus; count: string }>,
) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(recentRegistrations),
  getRawMany: jest.fn().mockResolvedValue(statsRows),
});

describe('DashboardService', () => {
  let service: DashboardService;

  const recentTournaments = [{ id: 'tournament-1', name: 'Cup' }];
  const recentClubs = [{ id: 'club-1', name: 'Club' }];
  const recentRegistrations = [{ id: 'registration-1' }];
  const statsRows = [
    { status: RegistrationStatus.APPROVED, count: '3' },
    { status: RegistrationStatus.PENDING, count: '2' },
    { status: RegistrationStatus.PENDING_PAYMENT, count: '1' },
  ];

  const tournamentRepository = {
    find: jest.fn().mockResolvedValue(recentTournaments),
    count: jest.fn().mockResolvedValue(7),
  };
  const clubRepository = {
    find: jest.fn().mockResolvedValue(recentClubs),
    count: jest.fn().mockResolvedValue(4),
  };
  const registrationRepository = {
    createQueryBuilder: jest
      .fn()
      .mockImplementation(() =>
        createRegistrationQueryBuilder(recentRegistrations, statsRows),
      ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Tournament), useValue: tournamentRepository },
        { provide: getRepositoryToken(Club), useValue: clubRepository },
        { provide: getRepositoryToken(Registration), useValue: registrationRepository },
      ],
    }).compile();

    service = module.get(DashboardService);
    jest.clearAllMocks();
  });

  it('returns compact summary for an organizer without per-tournament requests', async () => {
    const summary = await service.getSummary({
      sub: 'organizer-1',
      email: 'organizer@example.com',
      role: UserRole.ORGANIZER,
    });

    expect(summary).toEqual({
      stats: {
        tournaments: 7,
        clubs: 4,
        registrations: 6,
        approved: 3,
        pending: 3,
      },
      recentTournaments,
      recentClubs,
      recentRegistrations,
    });
    expect(tournamentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizerId: 'organizer-1' },
        take: 5,
      }),
    );
    expect(registrationRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
  });
});
