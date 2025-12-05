import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { Group } from './entities/group.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Registration } from '../registrations/entities/registration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Group, Tournament, Registration])],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
