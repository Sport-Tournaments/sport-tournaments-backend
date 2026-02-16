import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { Club } from '../clubs/entities/club.entity';
import { CreateTeamDto, TeamFilterDto, UpdateTeamDto } from './dto/team.dto';
import { JwtPayload } from '../../common/interfaces';
import { UserRole } from '../../common/enums';
import { Player } from '../players/entities';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(Club)
    private clubsRepository: Repository<Club>,
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
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

  private async resolvePlayers(playerIds?: string[]): Promise<Player[]> {
    if (!playerIds || playerIds.length === 0) {
      return [];
    }

    const players = await this.playersRepository.find({
      where: { id: In(playerIds) },
    });

    if (players.length !== playerIds.length) {
      throw new NotFoundException('One or more players were not found');
    }

    return players;
  }

  private async findByIdOrFail(id: string): Promise<Team> {
    const team = await this.teamsRepository.findOne({
      where: { id },
      relations: ['club', 'players'],
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  private async verifyTeamAccess(id: string, user: JwtPayload): Promise<Team> {
    const team = await this.findByIdOrFail(id);

    if (user.role !== UserRole.ADMIN && team.club.organizerId !== user.sub) {
      throw new ForbiddenException('You can only manage teams for your own clubs');
    }

    return team;
  }

  async findAll(filters: TeamFilterDto, user: JwtPayload): Promise<Team[]> {
    const queryBuilder = this.teamsRepository
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.players', 'players')
      .leftJoinAndSelect('team.club', 'club');

    if (filters.clubId) {
      await this.verifyClubAccess(filters.clubId, user);
      queryBuilder.andWhere('team.clubId = :clubId', { clubId: filters.clubId });
    } else if (user.role !== UserRole.ADMIN) {
      queryBuilder.andWhere('club.organizerId = :organizerId', {
        organizerId: user.sub,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(LOWER(team.name) LIKE LOWER(:search) OR LOWER(team.coach) LIKE LOWER(:search) OR LOWER(team.ageCategory) LIKE LOWER(:search))',
        { search: `%${filters.search}%` },
      );
    }

    return queryBuilder.orderBy('team.name', 'ASC').getMany();
  }

  async findOne(id: string, user: JwtPayload): Promise<Team> {
    return this.verifyTeamAccess(id, user);
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
      ageCategory: dto.ageCategory,
      birthyear: dto.birthyear,
      coach: dto.coach,
    });

    if (dto.playerIds) {
      team.players = await this.resolvePlayers(dto.playerIds);
    }

    return this.teamsRepository.save(team);
  }

  async update(id: string, user: JwtPayload, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.verifyTeamAccess(id, user);

    const targetClubId = dto.clubId ?? team.clubId;
    const targetName = dto.name ?? team.name;

    if (dto.clubId && dto.clubId !== team.clubId) {
      await this.verifyClubAccess(dto.clubId, user);
    }

    const existing = await this.teamsRepository.findOne({
      where: {
        clubId: targetClubId,
        name: targetName,
        id: Not(team.id),
      },
    });

    if (existing) {
      throw new ConflictException('Team with this name already exists');
    }

    if (dto.clubId !== undefined) {
      team.clubId = dto.clubId;
    }

    if (dto.name !== undefined) {
      team.name = dto.name;
    }

    if (dto.ageCategory !== undefined) {
      team.ageCategory = dto.ageCategory;
    }

    if (dto.birthyear !== undefined) {
      team.birthyear = dto.birthyear;
    }

    if (dto.coach !== undefined) {
      team.coach = dto.coach;
    }

    if (dto.playerIds !== undefined) {
      team.players = await this.resolvePlayers(dto.playerIds);
    }

    return this.teamsRepository.save(team);
  }

  async remove(id: string, user: JwtPayload): Promise<void> {
    const team = await this.verifyTeamAccess(id, user);
    await this.teamsRepository.remove(team);
  }

  async search(
    query: string,
    user: JwtPayload,
    clubId?: string,
    limit: number = 10,
  ): Promise<Team[]> {
    if (!query?.trim()) {
      return [];
    }

    const safeLimit = Math.min(Math.max(limit || 10, 1), 50);

    const queryBuilder = this.teamsRepository
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.players', 'players')
      .leftJoin('team.club', 'club')
      .where(
        '(LOWER(team.name) LIKE LOWER(:query) OR LOWER(team.coach) LIKE LOWER(:query) OR LOWER(team.ageCategory) LIKE LOWER(:query))',
        { query: `%${query}%` },
      );

    if (clubId) {
      await this.verifyClubAccess(clubId, user);
      queryBuilder.andWhere('team.clubId = :clubId', { clubId });
    } else if (user.role !== UserRole.ADMIN) {
      queryBuilder.andWhere('club.organizerId = :organizerId', {
        organizerId: user.sub,
      });
    }

    return queryBuilder.orderBy('team.name', 'ASC').take(safeLimit).getMany();
  }
}
