import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { Club } from '../clubs/entities/club.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Club])],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
