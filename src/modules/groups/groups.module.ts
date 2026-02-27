import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { Group } from './entities/group.entity';
import { TournamentPot } from './entities/tournament-pot.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentAgeGroup } from '../tournaments/entities/tournament-age-group.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { BracketGeneratorService } from './services/bracket-generator.service';
import { PotDrawService } from './services/pot-draw.service';

@Module({
  imports: [TypeOrmModule.forFeature([Group, TournamentPot, Tournament, TournamentAgeGroup, Registration])],
  controllers: [GroupsController],
  providers: [GroupsService, BracketGeneratorService, PotDrawService],
  exports: [GroupsService, BracketGeneratorService, PotDrawService],
})
export class GroupsModule {}
