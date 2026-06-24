import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Club } from '../clubs/entities/club.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament, Club, Registration])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
