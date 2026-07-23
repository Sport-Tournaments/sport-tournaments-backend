import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentStatus } from '../../common/enums';
import { SitemapService } from './sitemap.service';

const createQueryBuilder = (
  rows: Partial<Tournament>[],
  total = rows.length,
) => {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
    getCount: jest.fn().mockResolvedValue(total),
  };
  return qb;
};

describe('SitemapService', () => {
  let service: SitemapService;
  let qb: Record<string, jest.Mock>;

  const publicRows: Partial<Tournament>[] = [
    {
      urlSlug: 'pub-ongoing',
      updatedAt: new Date('2026-07-10T10:00:00Z'),
      status: TournamentStatus.ONGOING,
    },
    {
      urlSlug: 'amp&slug',
      updatedAt: new Date('2026-07-05T10:00:00Z'),
      status: TournamentStatus.PUBLISHED,
    },
    {
      urlSlug: 'pub-completed',
      updatedAt: new Date('2026-06-01T10:00:00Z'),
      status: TournamentStatus.COMPLETED,
    },
  ];

  const configValues: Record<string, string> = {
    'sitemap.baseUrl': 'https://api.tournamente.ro',
    'sitemap.tournamentPath': '/tournaments',
  };

  beforeEach(async () => {
    qb = createQueryBuilder(publicRows);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitemapService,
        {
          provide: getRepositoryToken(Tournament),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(qb) },
        },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();

    service = module.get<SitemapService>(SitemapService);
  });

  it('filters to public, published, non-private tournaments with a slug', async () => {
    await service.buildTournamentsSitemap(1);

    expect(qb.where).toHaveBeenCalledWith(
      'tournament.status IN (:...statuses)',
      {
        statuses: [
          TournamentStatus.PUBLISHED,
          TournamentStatus.ONGOING,
          TournamentStatus.COMPLETED,
        ],
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'tournament.isPublished = :isPublished',
      {
        isPublished: true,
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'tournament.isPrivate = :isPrivate',
      {
        isPrivate: false,
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('tournament.urlSlug IS NOT NULL');
  });

  it('emits well-formed <url> entries with lastmod/changefreq/priority', async () => {
    const xml = await service.buildTournamentsSitemap(1);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<loc>https://api.tournamente.ro/tournaments/pub-ongoing</loc>',
    );
    // Ongoing → daily / 0.8; completed → weekly / 0.5
    expect(xml).toContain('<changefreq>daily</changefreq>');
    expect(xml).toContain('<priority>0.5</priority>');
    expect(xml).toContain('<lastmod>2026-07-10T10:00:00.000Z</lastmod>');
  });

  it('escapes XML-significant characters in slugs', async () => {
    const xml = await service.buildTournamentsSitemap(1);
    expect(xml).toContain('/tournaments/amp&amp;slug');
    expect(xml).not.toContain('/tournaments/amp&slug<');
  });

  it('builds a sitemap index referencing static and tournament sub-sitemaps', async () => {
    qb.getCount.mockResolvedValue(3);
    const xml = await service.buildIndex();

    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain(
      '<loc>https://api.tournamente.ro/sitemap-static.xml</loc>',
    );
    expect(xml).toContain(
      '<loc>https://api.tournamente.ro/sitemap-tournaments.xml</loc>',
    );
  });

  it('paginates the index when tournaments exceed one sitemap page', async () => {
    qb.getCount.mockResolvedValue(45000); // > 20000 per page → 3 pages
    const xml = await service.buildIndex();

    expect(xml).toContain('sitemap-tournaments.xml</loc>'); // page 1 (no query)
    expect(xml).toContain('sitemap-tournaments.xml?page=2</loc>');
    expect(xml).toContain('sitemap-tournaments.xml?page=3</loc>');
    expect(xml).not.toContain('page=4');
  });

  it('exposes robots.txt advertising the sitemap index', () => {
    const txt = service.buildRobotsTxt();
    expect(txt).toContain('Sitemap: https://api.tournamente.ro/sitemap.xml');
    expect(txt).toContain('User-agent: *');
  });

  it('includes static home and tournament-listing pages', () => {
    const xml = service.buildStaticSitemap();
    expect(xml).toContain('<loc>https://api.tournamente.ro/</loc>');
    expect(xml).toContain('<loc>https://api.tournamente.ro/tournaments</loc>');
  });
});
