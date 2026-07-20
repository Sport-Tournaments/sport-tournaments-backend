import { Controller, Get, Query, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { SitemapService } from './sitemap.service';

const XML_TYPE = 'application/xml; charset=utf-8';
const ONE_HOUR = 'public, max-age=3600';

/**
 * Serves SEO artifacts at the host root (excluded from the global `api`
 * prefix and version — see main.ts):
 *   GET /sitemap.xml               → sitemap index (submit this to GSC)
 *   GET /sitemap-static.xml        → static public pages
 *   GET /sitemap-tournaments.xml   → public tournaments (paginated via ?page=)
 *   GET /robots.txt                → advertises the sitemap
 *
 * These endpoints write to the raw response so the global TransformInterceptor
 * does not wrap the XML/text body in a JSON envelope.
 */
@ApiExcludeController()
@Controller({ version: VERSION_NEUTRAL })
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Get('sitemap.xml')
  async index(@Res() res: Response): Promise<void> {
    const xml = await this.sitemapService.buildIndex();
    res.type(XML_TYPE).set('Cache-Control', ONE_HOUR).send(xml);
  }

  @Get('sitemap-static.xml')
  staticSitemap(@Res() res: Response): void {
    const xml = this.sitemapService.buildStaticSitemap();
    res.type(XML_TYPE).set('Cache-Control', ONE_HOUR).send(xml);
  }

  @Get('sitemap-tournaments.xml')
  async tournaments(
    @Res() res: Response,
    @Query('page') page?: string,
  ): Promise<void> {
    const parsed = page ? parseInt(page, 10) : 1;
    const xml = await this.sitemapService.buildTournamentsSitemap(
      Number.isNaN(parsed) ? 1 : parsed,
    );
    res.type(XML_TYPE).set('Cache-Control', ONE_HOUR).send(xml);
  }

  @Get('robots.txt')
  robots(@Res() res: Response): void {
    res
      .type('text/plain; charset=utf-8')
      .set('Cache-Control', 'public, max-age=86400')
      .send(this.sitemapService.buildRobotsTxt());
  }
}
