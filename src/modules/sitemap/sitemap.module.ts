import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Club } from '../clubs/entities/club.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament, Club])],
  controllers: [SitemapController],
  providers: [SitemapService],
})
export class SitemapModule {}
