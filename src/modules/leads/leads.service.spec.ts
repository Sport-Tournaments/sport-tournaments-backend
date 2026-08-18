import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { Lead } from './entities/lead.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { LeadStatus } from '../../common/enums';

const createQb = (rows: Partial<Lead>[], total = rows.length) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(total),
  getMany: jest.fn().mockResolvedValue(rows),
  getRawMany: jest.fn().mockResolvedValue([
    { status: LeadStatus.NEW, count: '2' },
    { status: LeadStatus.WON, count: '1' },
  ]),
});

describe('LeadsService', () => {
  let service: LeadsService;
  let qb: ReturnType<typeof createQb>;

  const lead: Partial<Lead> = {
    id: 'lead-1',
    tournamentName: 'Barcelona Cup',
    startDate: '2027-04-02',
    status: LeadStatus.NEW,
    location: 'Barcelona, Spain',
    sourceUrl: 'https://x/y',
    contactEmail: 'a@b.com',
    contactPhone: null,
    organiser: null,
    contactName: null,
    notes: null,
    assignedTo: null,
    source: 'young-talents-group',
  };

  const leadsRepo = {
    create: jest.fn((v) => v),
    save: jest.fn((v) => Promise.resolve(v)),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
  const tournamentsRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    qb = createQb([lead]);
    leadsRepo.createQueryBuilder.mockReturnValue(qb);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getRepositoryToken(Lead), useValue: leadsRepo },
        { provide: getRepositoryToken(Tournament), useValue: tournamentsRepo },
      ],
    }).compile();
    service = module.get(LeadsService);
    jest.clearAllMocks();
    leadsRepo.createQueryBuilder.mockReturnValue(qb);
    leadsRepo.create.mockImplementation((v) => v);
    leadsRepo.save.mockImplementation((v) => Promise.resolve(v));
  });

  it('creates a manual lead defaulting to NEW/manual source', async () => {
    await service.create({ tournamentName: 'X' });
    expect(leadsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: LeadStatus.NEW, source: 'manual' }),
    );
  });

  it('tags a lead linked to a tournament as source=platform', async () => {
    await service.create({ tournamentName: 'X', tournamentId: 't-1' });
    expect(leadsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'platform' }),
    );
  });

  it('lists with pagination meta', async () => {
    const res = await service.findAll({ page: 2, pageSize: 5 });
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
    expect(res.meta).toEqual({ total: 1, page: 2, limit: 5, totalPages: 1 });
  });

  it('applies status/search filters', async () => {
    await service.findAll({ status: LeadStatus.CONTACTED, search: 'cup' });
    expect(qb.andWhere).toHaveBeenCalledWith('lead.status = :status', {
      status: LeadStatus.CONTACTED,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), {
      q: '%cup%',
    });
  });

  it('throws NotFound for a missing lead', async () => {
    leadsRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
  });

  it('aggregates stats per status with zero-filled stages', async () => {
    const stats = await service.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byStatus[LeadStatus.NEW]).toBe(2);
    expect(stats.byStatus[LeadStatus.WON]).toBe(1);
    expect(stats.byStatus[LeadStatus.LOST]).toBe(0);
  });

  it('imports one lead per not-yet-seeded tournament (idempotent)', async () => {
    tournamentsRepo.find.mockResolvedValue([
      {
        id: 't-1',
        name: 'A',
        startDate: '2027-01-01',
        location: 'L',
        description: 'Source: https://src/a',
        urlSlug: 'euro-sportring-a',
      },
      { id: 't-2', name: 'B', urlSlug: 'young-talents-group-b' },
    ]);
    // t-2 already has a lead
    leadsRepo.find.mockResolvedValue([{ tournamentId: 't-2' }]);

    const res = await service.importFromTournaments();
    expect(res).toEqual({ created: 1, skipped: 1 });
    expect(leadsRepo.save).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          tournamentId: 't-1',
          sourceUrl: 'https://src/a',
          source: 'euro-sportring',
          status: LeadStatus.NEW,
        }),
      ],
      { chunk: 500 },
    );
  });

  it('exports CSV with a header row and RFC-4180 quoting', async () => {
    qb.getMany.mockResolvedValue([
      { ...lead, location: 'Pitești, Romania', notes: 'a, b' },
    ]);
    const csv = await service.exportCsv({});
    const [header, row] = csv.split('\r\n');
    expect(header).toBe(
      'Tournament Name,Start Date,Status,Organiser,Contact Name,Contact Email,Contact Phone,Location,Source URL,Assigned To,Notes,Source',
    );
    expect(row).toContain('"Pitești, Romania"');
    expect(row).toContain('"a, b"');
  });
});
