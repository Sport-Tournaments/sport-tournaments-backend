import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { Club } from '../clubs/entities/club.entity';
import { CreateTeamDto } from './dto/team.dto';
import { JwtPayload } from '../../common/interfaces';
import { UserRole } from '../../common/enums';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(Club)
    private clubsRepository: Repository<Club>,
  ) {}

  private async verifyClubAccess(clubId: string, user: JwtPayload) {
    const club = await this.clubsRepository.findOne({ where: { id: clubId } });
    if (!club) {
      throw new NotFoundException('Club not found');
    }

    if (user.role !== UserRole.ADMIN && club.organizerId !== user.sub) {
      throw new ForbiddenException('You can only manage teams for your own clubs');
    }

    return club;
  }

  async findByClub(clubId: string, user: JwtPayload): Promise<Team[]> {
    await this.verifyClubAccess(clubId, user);

    return this.teamsRepository.find({
      where: { clubId },
      order: { name: 'ASC' },
    });
  }

  async create(user: JwtPayload, dto: CreateTeamDto): Promise<Team> {
    await this.verifyClubAccess(dto.clubId, user);

    const existing = await this.teamsRepository.findOne({
      where: { clubId: dto.clubId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Team with this name already exists');
    }

    const team = this.teamsRepository.create({
      clubId: dto.clubId,
      name: dto.name,
    });

    return this.teamsRepository.save(team);
  }
}