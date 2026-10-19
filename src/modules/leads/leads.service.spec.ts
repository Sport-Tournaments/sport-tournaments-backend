import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { Lead } from './entities/lead.entity';
import { LeadActivity } from './entities/lead-activity.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Club } from '../clubs/entities/club.entity';
import { User } from '../users/entities/user.entity';
import {
  LeadActivityType,
  LeadPriority,
  LeadStatus,
  LeadType,
  UserRole,
} from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

const createQb = (rows: Partial<Lead>[], total = rows.length) => {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    'leftJoin',
    'leftJoinAndSelect',
    'leftJoinAndMapOne',
    'loadRelationCountAndMap',
    'addSelect',
    'select',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'groupBy',
    'skip',
    'take',
  ]) {
    qb[m] = jest.fn().mockReturnThis();
  }
  qb.getCount = jest.fn().mockResolvedValue(total);
  qb.getMany = jest.fn().mockResolvedValue(rows);
  qb.getOne = jest.fn().mockResolvedValue(rows[0] ?? null);
  qb.getManyAndCount = jest.fn().mockResolvedValue([rows, total]);
  qb.getRawMany = jest.fn().mockResolvedValue([
    { key: LeadStatus.NEW, count: '2' },
    { key: LeadStatus.WON, count: '1' },
  ]);
  return qb;
};

describe('LeadsService', () => {
  let service: LeadsService;
  let qb: ReturnType<typeof createQb>;

  const manager: JwtPayload = {
    sub: 'mgr-1',
    email: 'm@x.com',
    role: UserRole.MANAGER,
  };

  const lead: Partial<Lead> = {
    id: 'lead-1',
    type: LeadType.TOURNAMENT,
    name: 'Barcelona Cup',
    startDate: '2027-04-02',
    status: LeadStatus.NEW,
    priority: LeadPriority.MEDIUM,
    location: 'Barcelona, Spain',
    country: 'Spain',
    sourceUrl: 'https://x/y',
    contactEmail: 'a@b.com',
    contactPhone: null,
    organiser: null,
    contactName: null,
    notes: null,
    tags: [],
    assignedTo: null,
    assignedToId: null,
    source: 'young-talents-group',
  };

  const leadsRepo = {
    create: jest.fn((v) => v),
    save: jest.fn((v) => Promise.resolve(v)),
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    remove: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
  const activitiesRepo = {
    create: jest.fn((v) => v),
    save: jest.fn((v) => Promise.resolve({ ...v, createdAt: new Date() })),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
  const tournamentsRepo = { find: jest.fn(), findOne: jest.fn() };
  const clubsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
  const usersRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };

  beforeEach(async () => {
    qb = createQb([lead]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getRepositoryToken(Lead), useValue: leadsRepo },
        { provide: getRepositoryToken(LeadActivity), useValue: activitiesRepo },
        { provide: getRepositoryToken(Tournament), useValue: tournamentsRepo },
        { provide: getRepositoryToken(Club), useValue: clubsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();
    service = module.get(LeadsService);
    jest.clearAllMocks();
    for (const repo of [leadsRepo, activitiesRepo, clubsRepo, usersRepo]) {
      repo.createQueryBuilder.mockReturnValue(qb);
    }
    leadsRepo.create.mockImplementation((v) => v);
    leadsRepo.save.mockImplementation((v) =>
      Promise.resolve({ id: 'lead-1', ...v }),
    );
    leadsRepo.exists.mockResolvedValue(false);
    activitiesRepo.create.mockImplementation((v) => v);
    activitiesRepo.save.mockImplementation((v) =>
      Promise.resolve({ ...v, createdAt: new Date() }),
    );
  });

  describe('create', () => {
    it('defaults a manual lead to NEW / MEDIUM / manual source', async () => {
      await service.create({ name: 'X', tags: [' Spain ', 'spain', 'Cup'] });
      expect(leadsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: LeadStatus.NEW,
          priority: LeadPriority.MEDIUM,
          source: 'manual',
          type: LeadType.TOURNAMENT,
          tags: ['spain', 'cup'],
        }),
      );
    });

    it('infers type and platform source from the linked record', async () => {
      await service.create({ name: 'X', clubId: 'c-1' });
      expect(leadsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: LeadType.CLUB, source: 'platform' }),
      );
    });

    it('rejects linking a record that already has a lead', async () => {
      leadsRepo.exists.mockResolvedValue(true);
      await expect(
        service.create({ name: 'X', tournamentId: 't-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects linking more than one record', async () => {
      await expect(
        service.create({ name: 'X', tournamentId: 't-1', clubId: 'c-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('only assigns to admin/manager accounts', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u',
        role: UserRole.ORGANIZER,
      });
      await expect(
        service.create({ name: 'X', assignedToId: 'u' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('paginates', async () => {
      const res = await service.findAll({ page: 2, pageSize: 5 });
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(res.meta).toEqual({ total: 1, page: 2, limit: 5, totalPages: 1 });
    });

    it('applies status/type/tag filters and search', async () => {
      await service.findAll({
        status: LeadStatus.CONTACTED,
        type: LeadType.CLUB,
        tag: 'Spain',
        search: 'cup',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('lead.status = :status', {
        status: LeadStatus.CONTACTED,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('lead.type = :type', {
        type: LeadType.CLUB,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(':tag = ANY(lead.tags)', {
        tag: 'spain',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(expect.anything(), {
        q: '%cup%',
      });
    });

    it("resolves assignedToId='me' to the current user", async () => {
      await service.findAll({ assignedToId: 'me' }, manager);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.assignedToId = :assignee',
        { assignee: 'mgr-1' },
      );
    });

    it('filters overdue follow-ups', async () => {
      await service.findAll({ followUp: 'overdue' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.nextFollowUpAt < :startOfDay',
        { startOfDay: expect.any(Date) },
      );
    });

    it('sorts nulls last on the chosen column', async () => {
      await service.findAll({ sortBy: 'nextFollowUpAt', sortOrder: 'ASC' });
      expect(qb.orderBy).toHaveBeenCalledWith(
        'lead.nextFollowUpAt',
        'ASC',
        'NULLS LAST',
      );
    });
  });

  it('throws NotFound for a missing lead', async () => {
    qb.getOne.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
  });

  describe('update', () => {
    it('logs status and assignment changes on the timeline', async () => {
      qb.getOne.mockResolvedValue({ ...lead });
      usersRepo.findOne.mockResolvedValue({
        id: 'mgr-2',
        role: UserRole.MANAGER,
      });

      await service.update(
        'lead-1',
        {
          status: LeadStatus.LOST,
          lostReason: 'No budget',
          assignedToId: 'mgr-2',
        },
        manager,
      );

      expect(activitiesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LeadActivityType.STATUS_CHANGE,
          metadata: { from: LeadStatus.NEW, to: LeadStatus.LOST },
          content: 'No budget',
          authorId: 'mgr-1',
        }),
      );
      expect(activitiesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LeadActivityType.ASSIGNMENT,
          metadata: { from: null, to: 'mgr-2' },
        }),
      );
    });

    it('clears the follow-up when null is sent', async () => {
      qb.getOne.mockResolvedValue({ ...lead, nextFollowUpAt: new Date() });
      await service.update('lead-1', { nextFollowUpAt: null }, manager);
      expect(leadsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ nextFollowUpAt: null }),
      );
      expect(activitiesRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('activities', () => {
    it('a logged call stamps lastContactedAt and moves NEW → CONTACTED', async () => {
      leadsRepo.findOne.mockResolvedValue({ ...lead });
      await service.addActivity(
        'lead-1',
        { type: LeadActivityType.CALL, content: 'Left voicemail' },
        manager,
      );
      expect(leadsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: LeadStatus.CONTACTED,
          lastContactedAt: expect.any(Date),
        }),
      );
      expect(activitiesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: LeadActivityType.STATUS_CHANGE }),
      );
    });

    it('a note leaves the pipeline untouched', async () => {
      leadsRepo.findOne.mockResolvedValue({ ...lead });
      await service.addActivity(
        'lead-1',
        { type: LeadActivityType.NOTE, content: 'Prefers WhatsApp' },
        manager,
      );
      expect(leadsRepo.save).not.toHaveBeenCalled();
      expect(activitiesRepo.create).toHaveBeenCalledTimes(1);
    });

    it("forbids editing someone else's note unless admin", async () => {
      activitiesRepo.findOne.mockResolvedValue({
        id: 'a-1',
        type: LeadActivityType.NOTE,
        authorId: 'someone-else',
      });
      await expect(
        service.updateActivity('lead-1', 'a-1', { content: 'x' }, manager),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateActivity(
          'lead-1',
          'a-1',
          { content: 'x' },
          { ...manager, role: UserRole.ADMIN },
        ),
      ).resolves.toEqual(expect.objectContaining({ content: 'x' }));
    });

    it('forbids editing system entries', async () => {
      activitiesRepo.findOne.mockResolvedValue({
        id: 'a-1',
        type: LeadActivityType.STATUS_CHANGE,
        authorId: 'mgr-1',
      });
      await expect(
        service.removeActivity('lead-1', 'a-1', manager),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('aggregates stats with zero-filled stages', async () => {
    const stats = await service.getStats(manager);
    expect(stats.total).toBe(3);
    expect(stats.byStatus[LeadStatus.NEW]).toBe(2);
    expect(stats.byStatus[LeadStatus.WON]).toBe(1);
    expect(stats.byStatus[LeadStatus.LOST]).toBe(0);
    expect(stats.byType[LeadType.CLUB]).toBe(0);
    expect(stats).toHaveProperty('overdueFollowUps');
  });

  describe('importLeads', () => {
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
      qb.getRawMany.mockResolvedValue([{ id: 't-2' }]);

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

    it('maps clubs and organizers to leads', async () => {
      clubsRepo.find.mockResolvedValue([
        {
          id: 'c-1',
          name: 'FC A',
          city: 'Cluj',
          country: 'Romania',
          contactEmail: null,
          organizer: { firstName: 'Ana', lastName: 'Pop', email: 'ana@x.ro' },
        },
      ]);
      qb.getMany.mockResolvedValue([
        {
          id: 'u-1',
          firstName: 'Ion',
          lastName: 'Ionescu',
          email: 'ion@x.ro',
          organizationName: 'Cup Org',
        },
      ]);
      qb.getRawMany.mockResolvedValue([]);

      const res = await service.importLeads([
        LeadType.CLUB,
        LeadType.ORGANIZER,
      ]);
      expect(res.created).toBe(2);
      expect(leadsRepo.save).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            type: LeadType.CLUB,
            clubId: 'c-1',
            contactName: 'Ana Pop',
            contactEmail: 'ana@x.ro',
          }),
        ],
        { chunk: 500 },
      );
      expect(leadsRepo.save).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            type: LeadType.ORGANIZER,
            organizerId: 'u-1',
            name: 'Cup Org',
            contactEmail: 'ion@x.ro',
          }),
        ],
        { chunk: 500 },
      );
    });
  });

  describe('track', () => {
    it('returns the existing lead without creating a new one', async () => {
      leadsRepo.findOne.mockResolvedValue({ id: 'lead-1' });
      await service.track(LeadType.CLUB, 'c-1', manager);
      expect(leadsRepo.save).not.toHaveBeenCalled();
    });

    it('creates a lead assigned to the caller', async () => {
      leadsRepo.findOne.mockResolvedValue(null);
      clubsRepo.findOne.mockResolvedValue({ id: 'c-1', name: 'FC A' });
      await service.track(LeadType.CLUB, 'c-1', manager);
      expect(leadsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ clubId: 'c-1', assignedToId: 'mgr-1' }),
      );
    });

    it('404s for an unknown record', async () => {
      leadsRepo.findOne.mockResolvedValue(null);
      usersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.track(LeadType.ORGANIZER, 'u-x', manager),
      ).rejects.toThrow(NotFoundException);
    });
  });

  it('exports CSV with a header row and RFC-4180 quoting', async () => {
    qb.getMany.mockResolvedValue([
      {
        ...lead,
        location: 'Pitești, Romania',
        notes: 'a, b',
        tags: ['x', 'y'],
      },
    ]);
    const csv = await service.exportCsv({});
    const [header, row] = csv.split('\r\n');
    expect(header).toBe(
      'Name,Type,Start Date,Status,Priority,Organiser,Contact Name,Contact Email,Contact Phone,Location,Country,Website,Source URL,Assigned To,Next Follow-up,Last Contacted,Tags,Notes,Source',
    );
    expect(row).toContain('"Pitești, Romania"');
    expect(row).toContain('"a, b"');
    expect(row).toContain('x; y');
  });
});
