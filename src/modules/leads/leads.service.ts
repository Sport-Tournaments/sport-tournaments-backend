import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { CreateLeadDto, UpdateLeadDto, LeadFilterDto } from './dto';
import { LeadStatus } from '../../common/enums';
import { PaginatedResponse } from '../../common/interfaces';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
  ) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadsRepository.create({
      ...dto,
      status: dto.status ?? LeadStatus.NEW,
      source: dto.tournamentId ? 'platform' : 'manual',
    });
    return this.leadsRepository.save(lead);
  }

  async findAll(filter: LeadFilterDto): Promise<PaginatedResponse<Lead>> {
    const page = filter.page ?? 1;
    const limit = filter.pageSize ?? 20;

    const qb = this.leadsRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.assignedTo', 'assignedTo');

    if (filter.status) {
      qb.andWhere('lead.status = :status', { status: filter.status });
    }
    if (filter.assignedToId) {
      qb.andWhere('lead.assignedToId = :assignedToId', {
        assignedToId: filter.assignedToId,
      });
    }
    if (filter.source) {
      qb.andWhere('lead.source = :source', { source: filter.source });
    }
    if (filter.search) {
      qb.andWhere(
        `(lead.tournamentName ILIKE :q OR lead.organiser ILIKE :q OR lead.contactName ILIKE :q OR lead.contactEmail ILIKE :q)`,
        { q: `%${filter.search}%` },
      );
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('lead.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Lead> {
    const lead = await this.leadsRepository.findOne({
      where: { id },
      relations: ['assignedTo', 'tournament'],
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findOne(id);
    Object.assign(lead, dto);
    return this.leadsRepository.save(lead);
  }

  async remove(id: string): Promise<void> {
    const lead = await this.findOne(id);
    await this.leadsRepository.remove(lead);
  }

  /** Counts per pipeline stage plus the total — for the CRM dashboard. */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<LeadStatus, number>;
  }> {
    const rows = await this.leadsRepository
      .createQueryBuilder('lead')
      .select('lead.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('lead.status')
      .getRawMany<{ status: LeadStatus; count: string }>();

    const byStatus = Object.values(LeadStatus).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<LeadStatus, number>,
    );
    let total = 0;
    for (const row of rows) {
      const n = parseInt(row.count, 10);
      byStatus[row.status] = n;
      total += n;
    }
    return { total, byStatus };
  }

  /**
   * Create one lead per tournament that does not already have one. Idempotent:
   * existing leads are left untouched (their CRM state is preserved).
   */
  async importFromTournaments(): Promise<{
    created: number;
    skipped: number;
  }> {
    const tournaments = await this.tournamentsRepository.find({
      select: ['id', 'name', 'startDate', 'location', 'description', 'urlSlug'],
    });

    const existing = await this.leadsRepository.find({
      select: ['tournamentId'],
      where: {},
    });
    const seeded = new Set(
      existing.map((l) => l.tournamentId).filter(Boolean) as string[],
    );

    let skipped = 0;
    const toInsert: Lead[] = [];

    for (const t of tournaments) {
      if (seeded.has(t.id)) {
        skipped++;
        continue;
      }
      toInsert.push(
        this.leadsRepository.create({
          tournamentId: t.id,
          tournamentName: t.name,
          startDate: t.startDate
            ? typeof t.startDate === 'string'
              ? t.startDate
              : new Date(t.startDate).toISOString().slice(0, 10)
            : null,
          location: t.location ?? null,
          sourceUrl: extractSourceUrl(t.description),
          status: LeadStatus.NEW,
          source: sourceFromSlug(t.urlSlug),
        }),
      );
    }

    if (toInsert.length > 0) {
      // chunk keeps the parameter count sane on large imports.
      await this.leadsRepository.save(toInsert, { chunk: 500 });
    }

    return { created: toInsert.length, skipped };
  }

  /** Export the filtered leads as a CSV string (for a leads form / mail merge). */
  async exportCsv(filter: LeadFilterDto): Promise<string> {
    // Export ignores pagination — return every matching row.
    const { data } = await this.findAll({
      ...filter,
      page: 1,
      pageSize: 100000,
    });

    const headers = [
      'Tournament Name',
      'Start Date',
      'Status',
      'Organiser',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Location',
      'Source URL',
      'Assigned To',
      'Notes',
      'Source',
    ];

    const rows = data.map((l) => [
      l.tournamentName,
      l.startDate ?? '',
      l.status,
      l.organiser ?? '',
      l.contactName ?? '',
      l.contactEmail ?? '',
      l.contactPhone ?? '',
      l.location ?? '',
      l.sourceUrl ?? '',
      l.assignedTo
        ? `${l.assignedTo.firstName ?? ''} ${l.assignedTo.lastName ?? ''}`.trim()
        : '',
      l.notes ?? '',
      l.source ?? '',
    ]);

    return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
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
