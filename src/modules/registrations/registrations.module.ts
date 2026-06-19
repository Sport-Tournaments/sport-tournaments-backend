import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { Registration } from './entities/registration.entity';
import { RegistrationDocument } from './entities/registration-document.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentAgeGroup } from '../tournaments/entities/tournament-age-group.entity';
import { Club } from '../clubs/entities/club.entity';
import { Team } from '../teams/entities/team.entity';
import { Group } from '../groups/entities/group.entity';
import { TournamentPot } from '../groups/entities/tournament-pot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Registration,
      RegistrationDocument,
      Tournament,
      TournamentAgeGroup,
      Club,
      Team,
      Group,
      TournamentPot,
    ]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
