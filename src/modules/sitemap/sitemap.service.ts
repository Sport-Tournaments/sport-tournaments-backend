import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentStatus } from '../../common/enums';

/**
 * Max URLs per sitemap file per the sitemaps.org protocol (50,000).
 * We use a smaller page size so each file stays comfortably under the
 * 50MB uncompressed limit and paginates cleanly.
 */
const URLS_PER_SITEMAP = 20000;

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
}

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);

  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl(): string {
    // Trim any trailing slash so we can join paths safely.
    return (
      this.configService.get<string>('sitemap.baseUrl') ||
      'http://localhost:3002'
    ).replace(/\/+$/, '');
  }

  private get tournamentPath(): string {
    const path =
      this.configService.get<string>('sitemap.tournamentPath') ||
      '/tournaments';
    return `/${path.replace(/^\/+|\/+$/g, '')}`;
  }

  /** Statuses whose tournaments are publicly visible and worth indexing. */
  private static readonly INDEXABLE_STATUSES = [
    TournamentStatus.PUBLISHED,
    TournamentStatus.ONGOING,
    TournamentStatus.COMPLETED,
  ];

  /** Count of public tournaments eligible for the sitemap. */
  private async countPublicTournaments(): Promise<number> {
    return this.publicTournamentsQuery().getCount();
  }

  private publicTournamentsQuery() {
    return this.tournamentRepository
      .createQueryBuilder('tournament')
      .where('tournament.status IN (:...statuses)', {
        statuses: SitemapService.INDEXABLE_STATUSES,
      })
      .andWhere('tournament.isPublished = :isPublished', { isPublished: true })
      .andWhere('tournament.isPrivate = :isPrivate', { isPrivate: false })
      .andWhere('tournament.urlSlug IS NOT NULL');
  }

  /**
   * Number of paginated tournament sitemap files needed (at least 1).
   */
  async getTournamentSitemapPageCount(): Promise<number> {
    const total = await this.countPublicTournaments();
    return Math.max(1, Math.ceil(total / URLS_PER_SITEMAP));
  }

  /**
   * Sitemap index (`/sitemap.xml`) — references the static and tournament
   * sub-sitemaps. This is the URL to submit to Google Search Console.
   */
  async buildIndex(): Promise<string> {
    const base = this.baseApiUrl();
    const pages = await this.getTournamentSitemapPageCount();
    const now = new Date().toISOString();

    const entries: string[] = [
      this.sitemapIndexEntry(`${base}/sitemap-static.xml`, now),
    ];
    for (let page = 1; page <= pages; page++) {
      entries.push(
        this.sitemapIndexEntry(
          `${base}/sitemap-tournaments.xml${page > 1 ? `?page=${page}` : ''}`,
          now,
        ),
      );
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      '</sitemapindex>',
      '',
    ].join('\n');
  }

  /**
   * Static, well-known public pages (home, tournament listing).
   */
  buildStaticSitemap(): string {
    const urls: SitemapUrl[] = [
      { loc: `${this.baseUrl}/`, changefreq: 'daily', priority: 1.0 },
      {
        loc: `${this.baseUrl}${this.tournamentPath}`,
        changefreq: 'daily',
        priority: 0.9,
      },
    ];
    return this.buildUrlset(urls);
  }

  /**
   * One paginated page of public tournament URLs.
   * @param page 1-based page number.
   */
  async buildTournamentsSitemap(page = 1): Promise<string> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

    const tournaments = await this.publicTournamentsQuery()
      .select([
        'tournament.urlSlug',
        'tournament.updatedAt',
        'tournament.status',
      ])
      .orderBy('tournament.updatedAt', 'DESC')
      .skip((safePage - 1) * URLS_PER_SITEMAP)
      .take(URLS_PER_SITEMAP)
      .getMany();

    const urls: SitemapUrl[] = tournaments.map((tournament) => ({
      loc: `${this.baseUrl}${this.tournamentPath}/${tournament.urlSlug}`,
      lastmod: this.toIso(tournament.updatedAt),
      // Ongoing tournaments change often; finished ones rarely.
      changefreq:
        tournament.status === TournamentStatus.ONGOING ? 'daily' : 'weekly',
      priority: tournament.status === TournamentStatus.COMPLETED ? 0.5 : 0.8,
    }));

    if (urls.length === 0 && safePage > 1) {
      this.logger.warn(`Tournament sitemap page ${safePage} is empty`);
    }

    return this.buildUrlset(urls);
  }

  /** robots.txt content that advertises the sitemap index for crawlers. */
  buildRobotsTxt(): string {
    return [
      'User-agent: *',
      'Allow: /',
      `Sitemap: ${this.baseApiUrl()}/sitemap.xml`,
      '',
    ].join('\n');
  }

  // ── helpers ──────────────────────────────────────────────

  /**
   * The origin serving these sitemap files. The sitemap index and robots.txt
   * must reference sub-sitemaps on the same host that serves them, which is
   * this backend — not necessarily the frontend the URLs point at.
   */
  private baseApiUrl(): string {
    return (
      this.configService.get<string>('sitemap.baseUrl') || this.baseUrl
    ).replace(/\/+$/, '');
  }

  private toIso(value: Date | string | undefined): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private sitemapIndexEntry(loc: string, lastmod: string): string {
    return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`;
  }

  private buildUrlset(urls: SitemapUrl[]): string {
    const body = urls.map((url) => this.urlEntry(url)).join('\n');
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      body,
      '</urlset>',
      '',
    ].join('\n');
  }

  private urlEntry(url: SitemapUrl): string {
    const parts = [`    <loc>${escapeXml(url.loc)}</loc>`];
    if (url.lastmod) parts.push(`    <lastmod>${url.lastmod}</lastmod>`);
    if (url.changefreq)
      parts.push(`    <changefreq>${url.changefreq}</changefreq>`);
    if (url.priority !== undefined)
      parts.push(`    <priority>${url.priority.toFixed(1)}</priority>`);
    return `  <url>\n${parts.join('\n')}\n  </url>`;
  }
}

/** Escape the five XML-significant characters in a URL/text node. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
