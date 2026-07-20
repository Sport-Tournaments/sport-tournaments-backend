import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { Player } from './entities/player.entity';
import { Team } from '../teams/entities/team.entity';
import { Club } from '../clubs/entities/club.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Player, Team, Club])],
  controllers: [PlayersController],
  providers: [PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
