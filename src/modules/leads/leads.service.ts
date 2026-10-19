import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { LeadActivity } from './entities/lead-activity.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Club } from '../clubs/entities/club.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateLeadDto,
  UpdateLeadDto,
  LeadFilterDto,
  CreateLeadActivityDto,
  UpdateLeadActivityDto,
  BulkUpdateLeadsDto,
  CrmDirectoryFilterDto,
} from './dto';
import {
  LeadActivityType,
  LeadPriority,
  LeadStatus,
  LeadType,
  UserRole,
} from '../../common/enums';
import { JwtPayload, PaginatedResponse } from '../../common/interfaces';

/** Roles that work the CRM; they are assignable and never leads themselves. */
const CRM_STAFF_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

/** Activity kinds that count as reaching out to the prospect. */
const CONTACT_ACTIVITY_TYPES = [
  LeadActivityType.CALL,
  LeadActivityType.EMAIL,
  LeadActivityType.MEETING,
];

/** Public user columns safe to embed in CRM responses (no tokens). */
const userColumns = (alias: string) =>
  ['id', 'firstName', 'lastName', 'email', 'role'].map((c) => `${alias}.${c}`);

export interface LeadStats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  byType: Record<LeadType, number>;
  overdueFollowUps: number;
  dueToday: number;
  unassigned: number;
  assignedToMe: number;
}

export interface ImportResult {
  created: number;
  skipped: number;
  byType: Partial<Record<LeadType, { created: number; skipped: number }>>;
}

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(LeadActivity)
    private readonly activitiesRepository: Repository<LeadActivity>,
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Club)
    private readonly clubsRepository: Repository<Club>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // ─────────────────────────── Leads ───────────────────────────

  async create(dto: CreateLeadDto, actor?: JwtPayload): Promise<Lead> {
    const linked = [dto.tournamentId, dto.clubId, dto.organizerId].filter(
      Boolean,
    );
    if (linked.length > 1) {
      throw new BadRequestException(
        'A lead can link to at most one tournament, club or organizer',
      );
    }
    await this.assertNotTracked(dto);
    if (dto.assignedToId) await this.assertAssignable(dto.assignedToId);

    const lead = this.leadsRepository.create({
      ...dto,
      type: dto.type ?? inferType(dto),
      status: dto.status ?? LeadStatus.NEW,
      priority: dto.priority ?? LeadPriority.MEDIUM,
      tags: normalizeTags(dto.tags),
      nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
      source: linked.length ? 'platform' : 'manual',
    });
    const saved = await this.leadsRepository.save(lead);
    if (actor && saved.assignedToId) {
      await this.logActivity(saved.id, LeadActivityType.ASSIGNMENT, actor, {
        from: null,
        to: saved.assignedToId,
      });
    }
    return this.findOne(saved.id);
  }

  async findAll(
    filter: LeadFilterDto,
    actor?: JwtPayload,
  ): Promise<PaginatedResponse<Lead>> {
    const page = filter.page ?? 1;
    const limit = filter.pageSize ?? 20;

    const qb = this.leadsRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.assignedTo', 'assignedTo')
      .addSelect(userColumns('assignedTo'));

    this.applyFilters(qb, filter, actor);

    const total = await qb.getCount();
    const sortBy = filter.sortBy ?? 'createdAt';
    const order = filter.sortOrder ?? 'DESC';
    if (sortBy === 'priority') {
      // Enum order is LOW < MEDIUM < HIGH, so DESC puts HIGH first.
      qb.orderBy('lead.priority', order);
    } else {
      qb.orderBy(`lead.${sortBy}`, order, 'NULLS LAST');
    }
    const data = await qb
      .addOrderBy('lead.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Lead> {
    const lead = await this.leadsRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.assignedTo', 'assignedTo')
      .addSelect(userColumns('assignedTo'))
      .leftJoin('lead.organizer', 'organizer')
      .addSelect([
        ...userColumns('organizer'),
        'organizer.phone',
        'organizer.organizationName',
        'organizer.city',
      ])
      .leftJoin('lead.tournament', 'tournament')
      .addSelect([
        'tournament.id',
        'tournament.name',
        'tournament.startDate',
        'tournament.status',
        'tournament.location',
      ])
      .leftJoin('lead.club', 'club')
      .addSelect([
        'club.id',
        'club.name',
        'club.city',
        'club.country',
        'club.logo',
        'club.isVerified',
      ])
      .where('lead.id = :id', { id })
      .getOne();
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async update(
    id: string,
    dto: UpdateLeadDto,
    actor?: JwtPayload,
  ): Promise<Lead> {
    const lead = await this.findOne(id);
    const prevStatus = lead.status;
    const prevAssignee = lead.assignedToId;

    if (dto.assignedToId && dto.assignedToId !== prevAssignee) {
      await this.assertAssignable(dto.assignedToId);
    }

    const { nextFollowUpAt, tags, ...rest } = dto;
    Object.assign(lead, rest);
    if (nextFollowUpAt !== undefined) {
      lead.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    }
    if (tags !== undefined) lead.tags = normalizeTags(tags);
    // Drop the loaded relation so TypeORM persists the new FK, not the stale one.
    if (dto.assignedToId !== undefined)
      delete (lead as Partial<Lead>).assignedTo;

    await this.leadsRepository.save(lead);

    if (actor) {
      await this.logChanges(lead.id, actor, {
        prevStatus,
        nextStatus: lead.status,
        prevAssignee,
        nextAssignee: lead.assignedToId,
        reason: dto.lostReason,
      });
    }
    return this.findOne(id);
  }

  async bulkUpdate(
    dto: BulkUpdateLeadsDto,
    actor: JwtPayload,
  ): Promise<{ updated: number }> {
    const { ids, ...changes } = dto;
    if (Object.values(changes).every((v) => v === undefined)) {
      throw new BadRequestException('Nothing to update');
    }
    if (changes.assignedToId) await this.assertAssignable(changes.assignedToId);

    const leads = await this.leadsRepository.find({ where: { id: In(ids) } });
    for (const lead of leads) {
      const prevStatus = lead.status;
      const prevAssignee = lead.assignedToId;
      if (changes.status) lead.status = changes.status;
      if (changes.priority) lead.priority = changes.priority;
      if (changes.assignedToId !== undefined) {
        lead.assignedToId = changes.assignedToId;
      }
      await this.leadsRepository.save(lead);
      await this.logChanges(lead.id, actor, {
        prevStatus,
        nextStatus: lead.status,
        prevAssignee,
        nextAssignee: lead.assignedToId,
      });
    }
    return { updated: leads.length };
  }

  async remove(id: string): Promise<void> {
    const lead = await this.leadsRepository.findOne({ where: { id } });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    await this.leadsRepository.remove(lead);
  }

  /** Pipeline and workload counters for the CRM dashboard. */
  async getStats(actor?: JwtPayload): Promise<LeadStats> {
    const [statusRows, typeRows] = await Promise.all([
      this.countBy('status'),
      this.countBy('type'),
    ]);

    const byStatus = zeroed(Object.values(LeadStatus));
    let total = 0;
    for (const row of statusRows) {
      const n = parseInt(row.count, 10);
      byStatus[row.key as LeadStatus] = n;
      total += n;
    }
    const byType = zeroed(Object.values(LeadType));
    for (const row of typeRows) {
      byType[row.key as LeadType] = parseInt(row.count, 10);
    }

    const open = [LeadStatus.WON, LeadStatus.LOST];
    const { startOfDay, endOfDay } = dayBounds();
    const openQb = () =>
      this.leadsRepository
        .createQueryBuilder('lead')
        .where('lead.status NOT IN (:...closed)', { closed: open });

    const [overdueFollowUps, dueToday, unassigned, assignedToMe] =
      await Promise.all([
        openQb()
          .andWhere('lead.nextFollowUpAt < :startOfDay', { startOfDay })
          .getCount(),
        openQb()
          .andWhere('lead.nextFollowUpAt BETWEEN :startOfDay AND :endOfDay', {
            startOfDay,
            endOfDay,
          })
          .getCount(),
        openQb().andWhere('lead.assignedToId IS NULL').getCount(),
        actor
          ? openQb()
              .andWhere('lead.assignedToId = :me', { me: actor.sub })
              .getCount()
          : Promise.resolve(0),
      ]);

    return {
      total,
      byStatus,
      byType,
      overdueFollowUps,
      dueToday,
      unassigned,
      assignedToMe,
    };
  }

  /** Distinct tags in use, for filter dropdowns / autocomplete. */
  async getTags(): Promise<string[]> {
    const rows = await this.leadsRepository.query(
      `SELECT DISTINCT unnest(tags) AS tag FROM leads ORDER BY tag`,
    );
    return (rows as { tag: string }[]).map((r) => r.tag);
  }

  /** Staff accounts a lead can be assigned to. */
  async getAssignees(): Promise<Partial<User>[]> {
    return this.usersRepository.find({
      select: ['id', 'firstName', 'lastName', 'email', 'role'],
      where: { role: In(CRM_STAFF_ROLES), isActive: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  }

  // ───────────────────────── Activities ─────────────────────────

  async getActivities(leadId: string): Promise<LeadActivity[]> {
    await this.assertLeadExists(leadId);
    return this.activitiesRepository
      .createQueryBuilder('activity')
      .leftJoin('activity.author', 'author')
      .addSelect(userColumns('author'))
      .where('activity.leadId = :leadId', { leadId })
      .orderBy('activity.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Log a note or touchpoint. Touchpoints stamp `lastContactedAt` and move a
   * NEW lead to CONTACTED, so the pipeline reflects outreach automatically.
   */
  async addActivity(
    leadId: string,
    dto: CreateLeadActivityDto,
    actor: JwtPayload,
  ): Promise<LeadActivity> {
    const lead = await this.leadsRepository.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    const activity = await this.logActivity(
      leadId,
      dto.type,
      actor,
      null,
      dto.content,
    );

    const isContact = CONTACT_ACTIVITY_TYPES.includes(dto.type);
    const prevStatus = lead.status;
    if (isContact) {
      lead.lastContactedAt = activity.createdAt ?? new Date();
      if (lead.status === LeadStatus.NEW) lead.status = LeadStatus.CONTACTED;
    }
    if (dto.nextFollowUpAt) lead.nextFollowUpAt = new Date(dto.nextFollowUpAt);
    if (isContact || dto.nextFollowUpAt) {
      await this.leadsRepository.save(lead);
    }
    if (lead.status !== prevStatus) {
      await this.logActivity(leadId, LeadActivityType.STATUS_CHANGE, actor, {
        from: prevStatus,
        to: lead.status,
      });
    }
    return activity;
  }

  async updateActivity(
    leadId: string,
    activityId: string,
    dto: UpdateLeadActivityDto,
    actor: JwtPayload,
  ): Promise<LeadActivity> {
    const activity = await this.findEditableActivity(leadId, activityId, actor);
    activity.content = dto.content;
    return this.activitiesRepository.save(activity);
  }

  async removeActivity(
    leadId: string,
    activityId: string,
    actor: JwtPayload,
  ): Promise<void> {
    const activity = await this.findEditableActivity(leadId, activityId, actor);
    await this.activitiesRepository.remove(activity);
  }

  // ───────────────────────── Directories ─────────────────────────

  /** Every club on the platform, with its CRM lead (if any). */
  async listClubs(
    filter: CrmDirectoryFilterDto,
  ): Promise<PaginatedResponse<Club & { lead: Lead | null }>> {
    const page = filter.page ?? 1;
    const limit = filter.pageSize ?? 20;

    const qb = this.clubsRepository
      .createQueryBuilder('club')
      .leftJoin('club.organizer', 'owner')
      .addSelect([...userColumns('owner'), 'owner.phone'])
      .leftJoinAndMapOne('club.lead', Lead, 'lead', 'lead.clubId = club.id')
      .leftJoin('lead.assignedTo', 'assignedTo')
      .addSelect(userColumns('assignedTo'));

    if (filter.search) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('club.name ILIKE :q')
            .orWhere('club.city ILIKE :q')
            .orWhere('club.contactEmail ILIKE :q')
            .orWhere('owner.email ILIKE :q'),
        ),
        { q: `%${filter.search}%` },
      );
    }
    if (filter.country) {
      qb.andWhere('club.country ILIKE :country', { country: filter.country });
    }
    applyTracking(qb, filter.tracking);

    const [data, total] = await qb
      .orderBy('club.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: data as (Club & { lead: Lead | null })[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Tournament organizers: users with the ORGANIZER role or who own at least
   * one tournament (staff excluded), with tournament/club counts and lead.
   */
  async listOrganizers(filter: CrmDirectoryFilterDto): Promise<
    PaginatedResponse<
      Partial<User> & {
        lead: Lead | null;
        tournamentCount: number;
        clubCount: number;
      }
    >
  > {
    const page = filter.page ?? 1;
    const limit = filter.pageSize ?? 20;

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .select([
        ...userColumns('u'),
        'u.phone',
        'u.city',
        'u.organizationName',
        'u.isActive',
        'u.createdAt',
      ])
      .leftJoinAndMapOne('u.lead', Lead, 'lead', 'lead.organizerId = u.id')
      .leftJoin('lead.assignedTo', 'assignedTo')
      .addSelect(userColumns('assignedTo'))
      .loadRelationCountAndMap('u.tournamentCount', 'u.tournaments')
      .loadRelationCountAndMap('u.clubCount', 'u.clubs')
      .where(
        new Brackets((w) =>
          w
            .where('u.role = :organizer', { organizer: UserRole.ORGANIZER })
            .orWhere(
              'EXISTS (SELECT 1 FROM tournaments t WHERE t.organizer_id = u.id)',
            ),
        ),
      )
      .andWhere('u.role NOT IN (:...staff)', { staff: CRM_STAFF_ROLES });

    if (filter.search) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('u.email ILIKE :q')
            .orWhere('u.firstName ILIKE :q')
            .orWhere('u.lastName ILIKE :q')
            .orWhere('u.organizationName ILIKE :q'),
        ),
        { q: `%${filter.search}%` },
      );
    }
    if (filter.country) {
      // Users have no country; match organizers running tournaments there.
      qb.andWhere(
        'EXISTS (SELECT 1 FROM tournaments t WHERE t.organizer_id = u.id AND t.country ILIKE :country)',
        { country: filter.country },
      );
    }
    applyTracking(qb, filter.tracking);

    const [data, total] = await qb
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: data as unknown as (Partial<User> & {
        lead: Lead | null;
        tournamentCount: number;
        clubCount: number;
      })[],
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Start tracking a platform record: returns its existing lead, or creates
   * one pre-filled from the record.
   */
  async track(type: LeadType, recordId: string, actor: JwtPayload) {
    const existing = await this.leadsRepository.findOne({
      where: linkWhere(type, recordId),
    });
    if (existing) return this.findOne(existing.id);

    let lead: Lead | null = null;
    if (type === LeadType.TOURNAMENT) {
      const t = await this.tournamentsRepository.findOne({
        where: { id: recordId },
      });
      lead = t ? this.leadFromTournament(t) : null;
    } else if (type === LeadType.CLUB) {
      const c = await this.clubsRepository.findOne({
        where: { id: recordId },
        relations: ['organizer'],
      });
      lead = c ? this.leadFromClub(c) : null;
    } else {
      const u = await this.usersRepository.findOne({ where: { id: recordId } });
      lead = u ? this.leadFromOrganizer(u) : null;
    }
    if (!lead) throw new NotFoundException(`${type} ${recordId} not found`);

    lead.assignedToId = actor.sub;
    const saved = await this.leadsRepository.save(lead);
    await this.logActivity(saved.id, LeadActivityType.ASSIGNMENT, actor, {
      from: null,
      to: actor.sub,
    });
    return this.findOne(saved.id);
  }

  /**
   * Create one lead per tournament / club / organizer that does not already
   * have one. Idempotent: existing leads keep their CRM state.
   */
  async importLeads(
    types: LeadType[] = Object.values(LeadType),
  ): Promise<ImportResult> {
    const result: ImportResult = { created: 0, skipped: 0, byType: {} };

    for (const type of new Set(types)) {
      const records = await this.loadImportCandidates(type);
      const column = linkColumn(type);
      const existing = await this.leadsRepository
        .createQueryBuilder('lead')
        .select(`lead.${column}`, 'id')
        .where(`lead.${column} IS NOT NULL`)
        .getRawMany<{ id: string }>();
      const seeded = new Set(existing.map((r) => r.id));

      const toInsert = records.filter((l) => !seeded.has(linkedId(l)!));
      if (toInsert.length > 0) {
        // chunk keeps the parameter count sane on large imports.
        await this.leadsRepository.save(toInsert, { chunk: 500 });
      }
      const skipped = records.length - toInsert.length;
      result.byType[type] = { created: toInsert.length, skipped };
      result.created += toInsert.length;
      result.skipped += skipped;
    }
    return result;
  }

  /** Back-compat: tournament-only import. */
  async importFromTournaments(): Promise<{ created: number; skipped: number }> {
    const { created, skipped } = await this.importLeads([LeadType.TOURNAMENT]);
    return { created, skipped };
  }

  /** Export the filtered leads as a CSV string (for a leads form / mail merge). */
  async exportCsv(filter: LeadFilterDto, actor?: JwtPayload): Promise<string> {
    // Export ignores pagination — return every matching row.
    const qb = this.leadsRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.assignedTo', 'assignedTo')
      .addSelect(userColumns('assignedTo'));
    this.applyFilters(qb, filter, actor);
    const data = await qb.orderBy('lead.createdAt', 'DESC').getMany();

    const headers = [
      'Name',
      'Type',
      'Start Date',
      'Status',
      'Priority',
      'Organiser',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Location',
      'Country',
      'Website',
      'Source URL',
      'Assigned To',
      'Next Follow-up',
      'Last Contacted',
      'Tags',
      'Notes',
      'Source',
    ];

    const rows = data.map((l) => [
      l.name,
      l.type,
      l.startDate ?? '',
      l.status,
      l.priority,
      l.organiser ?? '',
      l.contactName ?? '',
      l.contactEmail ?? '',
      l.contactPhone ?? '',
      l.location ?? '',
      l.country ?? '',
      l.website ?? '',
      l.sourceUrl ?? '',
      l.assignedTo
        ? `${l.assignedTo.firstName ?? ''} ${l.assignedTo.lastName ?? ''}`.trim()
        : '',
      l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toISOString() : '',
      l.lastContactedAt ? new Date(l.lastContactedAt).toISOString() : '',
      (l.tags ?? []).join('; '),
      l.notes ?? '',
      l.source ?? '',
    ]);

    return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  // ─────────────────────────── Internals ───────────────────────────

  private applyFilters(
    qb: SelectQueryBuilder<Lead>,
    filter: LeadFilterDto,
    actor?: JwtPayload,
  ): void {
    if (filter.status) {
      qb.andWhere('lead.status = :status', { status: filter.status });
    }
    if (filter.type) {
      qb.andWhere('lead.type = :type', { type: filter.type });
    }
    if (filter.priority) {
      qb.andWhere('lead.priority = :priority', { priority: filter.priority });
    }
    if (filter.unassigned) {
      qb.andWhere('lead.assignedToId IS NULL');
    } else if (filter.assignedToId) {
      const assignee =
        filter.assignedToId === 'me' ? actor?.sub : filter.assignedToId;
      qb.andWhere('lead.assignedToId = :assignee', { assignee });
    }
    if (filter.source) {
      qb.andWhere('lead.source = :source', { source: filter.source });
    }
    if (filter.country) {
      qb.andWhere('lead.country ILIKE :country', { country: filter.country });
    }
    if (filter.tag) {
      qb.andWhere(':tag = ANY(lead.tags)', { tag: filter.tag.toLowerCase() });
    }
    if (filter.followUp) {
      const { startOfDay, endOfDay } = dayBounds();
      if (filter.followUp === 'none') {
        qb.andWhere('lead.nextFollowUpAt IS NULL');
      } else if (filter.followUp === 'overdue') {
        qb.andWhere('lead.nextFollowUpAt < :startOfDay', { startOfDay });
      } else if (filter.followUp === 'today') {
        qb.andWhere('lead.nextFollowUpAt BETWEEN :startOfDay AND :endOfDay', {
          startOfDay,
          endOfDay,
        });
      } else {
        const endOfWeek = new Date(endOfDay.getTime() + 6 * 86_400_000);
        qb.andWhere('lead.nextFollowUpAt BETWEEN :startOfDay AND :endOfWeek', {
          startOfDay,
          endOfWeek,
        });
      }
    }
    if (filter.search) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('lead.name ILIKE :q')
            .orWhere('lead.organiser ILIKE :q')
            .orWhere('lead.contactName ILIKE :q')
            .orWhere('lead.contactEmail ILIKE :q')
            .orWhere('lead.location ILIKE :q'),
        ),
        { q: `%${filter.search}%` },
      );
    }
  }

  private async countBy(
    column: 'status' | 'type',
  ): Promise<{ key: string; count: string }[]> {
    return this.leadsRepository
      .createQueryBuilder('lead')
      .select(`lead.${column}`, 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`lead.${column}`)
      .getRawMany<{ key: string; count: string }>();
  }

  private async logActivity(
    leadId: string,
    type: LeadActivityType,
    actor: JwtPayload,
    metadata: Record<string, unknown> | null = null,
    content: string | null = null,
  ): Promise<LeadActivity> {
    return this.activitiesRepository.save(
      this.activitiesRepository.create({
        leadId,
        type,
        content,
        metadata,
        authorId: actor.sub,
      }),
    );
  }

  private async logChanges(
    leadId: string,
    actor: JwtPayload,
    c: {
      prevStatus: LeadStatus;
      nextStatus: LeadStatus;
      prevAssignee: string | null;
      nextAssignee: string | null;
      reason?: string;
    },
  ): Promise<void> {
    if (c.prevStatus !== c.nextStatus) {
      await this.logActivity(
        leadId,
        LeadActivityType.STATUS_CHANGE,
        actor,
        { from: c.prevStatus, to: c.nextStatus },
        c.nextStatus === LeadStatus.LOST ? (c.reason ?? null) : null,
      );
    }
    if (c.prevAssignee !== c.nextAssignee) {
      await this.logActivity(leadId, LeadActivityType.ASSIGNMENT, actor, {
        from: c.prevAssignee,
        to: c.nextAssignee,
      });
    }
  }

  private async findEditableActivity(
    leadId: string,
    activityId: string,
    actor: JwtPayload,
  ): Promise<LeadActivity> {
    const activity = await this.activitiesRepository.findOne({
      where: { id: activityId, leadId },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    const systemTypes = [
      LeadActivityType.STATUS_CHANGE,
      LeadActivityType.ASSIGNMENT,
    ];
    if (systemTypes.includes(activity.type)) {
      throw new ForbiddenException('System activity cannot be changed');
    }
    if (activity.authorId !== actor.sub && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the author or an admin can do this');
    }
    return activity;
  }

  private async assertLeadExists(id: string): Promise<void> {
    const exists = await this.leadsRepository.exists({ where: { id } });
    if (!exists) throw new NotFoundException(`Lead ${id} not found`);
  }

  private async assertAssignable(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      select: ['id', 'role'],
      where: { id: userId },
    });
    if (!user || !CRM_STAFF_ROLES.includes(user.role)) {
      throw new BadRequestException(
        'Leads can only be assigned to admin or manager accounts',
      );
    }
  }

  private async assertNotTracked(dto: CreateLeadDto): Promise<void> {
    const type = dto.tournamentId
      ? LeadType.TOURNAMENT
      : dto.clubId
        ? LeadType.CLUB
        : dto.organizerId
          ? LeadType.ORGANIZER
          : null;
    if (!type) return;
    const id = (dto.tournamentId ?? dto.clubId ?? dto.organizerId)!;
    const exists = await this.leadsRepository.exists({
      where: linkWhere(type, id),
    });
    if (exists) {
      throw new BadRequestException(
        `This ${type.toLowerCase()} already has a lead`,
      );
    }
  }

  private async loadImportCandidates(type: LeadType): Promise<Lead[]> {
    if (type === LeadType.TOURNAMENT) {
      const tournaments = await this.tournamentsRepository.find({
        select: [
          'id',
          'name',
          'startDate',
          'location',
          'country',
          'description',
          'urlSlug',
          'contactEmail',
          'contactPhone',
        ],
      });
      return tournaments.map((t) => this.leadFromTournament(t));
    }
    if (type === LeadType.CLUB) {
      const clubs = await this.clubsRepository.find({
        relations: ['organizer'],
      });
      return clubs.map((c) => this.leadFromClub(c));
    }
    const organizers = await this.usersRepository
      .createQueryBuilder('u')
      .where(
        new Brackets((w) =>
          w
            .where('u.role = :organizer', { organizer: UserRole.ORGANIZER })
            .orWhere(
              'EXISTS (SELECT 1 FROM tournaments t WHERE t.organizer_id = u.id)',
            ),
        ),
      )
      .andWhere('u.role NOT IN (:...staff)', { staff: CRM_STAFF_ROLES })
      .getMany();
    return organizers.map((u) => this.leadFromOrganizer(u));
  }

  private leadFromTournament(t: Tournament): Lead {
    return this.leadsRepository.create({
      type: LeadType.TOURNAMENT,
      tournamentId: t.id,
      name: t.name,
      startDate: t.startDate
        ? typeof t.startDate === 'string'
          ? t.startDate
          : new Date(t.startDate).toISOString().slice(0, 10)
        : null,
      location: t.location ?? null,
      country: t.country ?? null,
      contactEmail: t.contactEmail ?? null,
      contactPhone: t.contactPhone ?? null,
      sourceUrl: extractSourceUrl(t.description),
      status: LeadStatus.NEW,
      source: sourceFromSlug(t.urlSlug),
    });
  }

  private leadFromClub(c: Club): Lead {
    const owner = c.organizer;
    return this.leadsRepository.create({
      type: LeadType.CLUB,
      clubId: c.id,
      name: c.name,
      location: c.city ?? null,
      country: c.country ?? null,
      website: c.website ?? null,
      contactName: owner ? `${owner.firstName} ${owner.lastName}`.trim() : null,
      contactEmail: c.contactEmail ?? owner?.email ?? null,
      contactPhone: c.contactPhone ?? owner?.phone ?? null,
      status: LeadStatus.NEW,
      source: 'platform',
    });
  }

  private leadFromOrganizer(u: User): Lead {
    const fullName = `${u.firstName} ${u.lastName}`.trim();
    return this.leadsRepository.create({
      type: LeadType.ORGANIZER,
      organizerId: u.id,
      name: u.organizationName || fullName,
      organiser: u.organizationName ?? null,
      contactName: fullName,
      contactEmail: u.email,
      contactPhone: u.phone ?? null,
      location: u.city ?? null,
      status: LeadStatus.NEW,
      source: 'platform',
    });
  }
}

function inferType(dto: CreateLeadDto): LeadType {
  if (dto.clubId) return LeadType.CLUB;
  if (dto.organizerId) return LeadType.ORGANIZER;
  return LeadType.TOURNAMENT;
}

function linkColumn(type: LeadType): 'tournamentId' | 'clubId' | 'organizerId' {
  if (type === LeadType.CLUB) return 'clubId';
  if (type === LeadType.ORGANIZER) return 'organizerId';
  return 'tournamentId';
}

function linkWhere(type: LeadType, id: string) {
  return { [linkColumn(type)]: id };
}

function linkedId(lead: Lead): string | null {
  return lead.tournamentId ?? lead.clubId ?? lead.organizerId ?? null;
}

function applyTracking(
  qb: SelectQueryBuilder<any>,
  tracking?: 'tracked' | 'untracked',
): void {
  if (tracking === 'tracked') qb.andWhere('lead.id IS NOT NULL');
  if (tracking === 'untracked') qb.andWhere('lead.id IS NULL');
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

function zeroed<K extends string>(keys: K[]): Record<K, number> {
  return keys.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<K, number>);
}

/** Server-local day bounds, used for "overdue" / "due today". */
function dayBounds(now = new Date()): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

/** RFC-4180 CSV escaping: quote when the value contains ", comma, or newline. */
function csvCell(value: string): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Pull the "Source: <url>" line the importers embed in the description. */
function extractSourceUrl(description?: string | null): string | null {
  if (!description) return null;
  const match = /Source:\s*(\S+)/i.exec(description);
  return match ? match[1] : null;
}

function sourceFromSlug(urlSlug?: string | null): string {
  if (!urlSlug) return 'platform';
  if (urlSlug.startsWith('young-talents-group-')) return 'young-talents-group';
  if (urlSlug.startsWith('euro-sportring-')) return 'euro-sportring';
  return 'platform';
}
