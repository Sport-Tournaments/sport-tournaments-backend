import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { Registration } from './entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Club } from '../clubs/entities/club.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Registration, Tournament, Club])],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
