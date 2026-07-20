import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Not } from 'typeorm';
import { UserRole } from '../../common/enums';
import { Club } from '../clubs/entities/club.entity';
import { Player } from '../players/entities';
import { Team } from './entities/team.entity';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  let service: TeamsService;

  const mockTeamsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockClubsRepository = {
    findOne: jest.fn(),
  };

  const mockPlayersRepository = {
    find: jest.fn(),
  };

  const user = {
    sub: 'organizer-1',
    email: 'organizer@example.com',
    role: UserRole.ORGANIZER,
  };

  const existingTeam = {
    id: 'team-u8',
    clubId: 'club-1',
    name: 'Kinder Constanta',
    ageCategory: 'U8',
    birthyear: 2018,
    coach: 'Coach U8',
    club: {
      id: 'club-1',
      organizerId: 'organizer-1',
    },
    players: [],
  } as unknown as Team;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        {
          provide: getRepositoryToken(Team),
          useValue: mockTeamsRepository,
        },
        {
          provide: getRepositoryToken(Club),
          useValue: mockClubsRepository,
        },
        {
          provide: getRepositoryToken(Player),
          useValue: mockPlayersRepository,
        },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows the same team name in the same club when the age category differs', async () => {
    mockTeamsRepository.findOne
      .mockResolvedValueOnce(existingTeam)
      .mockResolvedValueOnce(null);
    mockTeamsRepository.save.mockImplementation(async (team: Team) => team);

    const result = await service.update('team-u8', user, {
      name: 'Kinder Constanta',
      ageCategory: 'U8',
      birthyear: 2018,
      coach: 'Kinder U8',
    });

    expect(result.name).toBe('Kinder Constanta');
    expect(mockTeamsRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        clubId: 'club-1',
        name: 'Kinder Constanta',
        ageCategory: 'U8',
        birthyear: 2018,
        id: Not('team-u8'),
      },
    });
    expect(mockTeamsRepository.save).toHaveBeenCalled();
  });

  it('rejects duplicate team names only within the same age category and birth year', async () => {
    mockTeamsRepository.findOne
      .mockResolvedValueOnce(existingTeam)
      .mockResolvedValueOnce({
        ...existingTeam,
        id: 'other-team-u8',
      });

    await expect(
      service.update('team-u8', user, {
        name: 'Kinder Constanta',
        ageCategory: 'U8',
        birthyear: 2018,
      }),
    ).rejects.toThrow(ConflictException);

    expect(mockTeamsRepository.save).not.toHaveBeenCalled();
  });
});
