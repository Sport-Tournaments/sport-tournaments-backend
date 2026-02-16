import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { Team } from '../teams/entities/team.entity';
import { Club } from '../clubs/entities/club.entity';
import {
  CreatePlayerDto,
  PlayerFilterDto,
  UpdatePlayerDto,
} from './dto/player.dto';
import { JwtPayload } from '../../common/interfaces';
import { UserRole } from '../../common/enums';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player)
    private readonly playersRepository: Repository<Player>,
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(Club)
    private readonly clubsRepository: Repository<Club>,
  ) {}

  private async resolveTeams(teamIds: string[], user: JwtPayload): Promise<Team[]> {
    if (!teamIds?.length) {
      return [];
    }

    const teams = await this.teamsRepository.find({
      where: { id: In(teamIds) },
      relations: ['club'],
    });

    if (teams.length !== teamIds.length) {
      throw new NotFoundException('One or more teams were not found');
    }

    if (user.role !== UserRole.ADMIN) {
      const unauthorized = teams.some((team) => team.club.organizerId !== user.sub);

      if (unauthorized) {
        throw new ForbiddenException('You can only manage players for your own clubs');
      }
    }

    return teams;
  }

  private async findByIdOrFail(id: string): Promise<Player> {
    const player = await this.playersRepository.findOne({
      where: { id },
      relations: ['teams', 'teams.club'],
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    return player;
  }

  private verifyPlayerAccess(player: Player, user: JwtPayload): void {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    const canAccess = player.teams.some((team) => team.club.organizerId === user.sub);
    if (!canAccess) {
      throw new ForbiddenException('You can only manage players for your own clubs');
    }
  }

  private createAccessScopedQuery(user: JwtPayload) {
    const queryBuilder = this.playersRepository
      .createQueryBuilder('player')
      .leftJoinAndSelect('player.teams', 'team')
      .leftJoinAndSelect('team.club', 'club');

    if (user.role !== UserRole.ADMIN) {
      queryBuilder.andWhere('club.organizerId = :organizerId', {
        organizerId: user.sub,
      });
    }

    return queryBuilder;
  }

  async findAll(filters: PlayerFilterDto, user: JwtPayload): Promise<Player[]> {
    const { page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.createAccessScopedQuery(user);

    if (filters.teamId) {
      queryBuilder.andWhere('team.id = :teamId', { teamId: filters.teamId });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(LOWER(player.firstname) LIKE LOWER(:search) OR LOWER(player.lastname) LIKE LOWER(:search))',
        { search: `%${filters.search}%` },
      );
    }

    return queryBuilder
      .orderBy('player.lastname', 'ASC')
      .addOrderBy('player.firstname', 'ASC')
      .skip(skip)
      .take(pageSize)
      .getMany();
  }

  async findOne(id: string, user: JwtPayload): Promise<Player> {
    const player = await this.findByIdOrFail(id);
    this.verifyPlayerAccess(player, user);
    return player;
  }

  async create(user: JwtPayload, dto: CreatePlayerDto): Promise<Player> {
    if (user.role !== UserRole.ADMIN && (!dto.teamIds || dto.teamIds.length === 0)) {
      throw new BadRequestException('teamIds is required for non-admin users');
    }

    const teams = await this.resolveTeams(dto.teamIds || [], user);

    const player = this.playersRepository.create({
      firstname: dto.firstname,
      lastname: dto.lastname,
      dateOfBirth: dto.dateOfBirth,
      teams,
    });

    return this.playersRepository.save(player);
  }

  async update(id: string, user: JwtPayload, dto: UpdatePlayerDto): Promise<Player> {
    const player = await this.findByIdOrFail(id);
    this.verifyPlayerAccess(player, user);

    if (dto.firstname !== undefined) {
      player.firstname = dto.firstname;
    }

    if (dto.lastname !== undefined) {
      player.lastname = dto.lastname;
    }

    if (dto.dateOfBirth !== undefined) {
      player.dateOfBirth = dto.dateOfBirth;
    }

    if (dto.teamIds !== undefined) {
      if (user.role !== UserRole.ADMIN && dto.teamIds.length === 0) {
        throw new BadRequestException('teamIds cannot be empty for non-admin users');
      }

      player.teams = await this.resolveTeams(dto.teamIds, user);
    }

    return this.playersRepository.save(player);
  }

  async remove(id: string, user: JwtPayload): Promise<void> {
    const player = await this.findByIdOrFail(id);
    this.verifyPlayerAccess(player, user);
    await this.playersRepository.remove(player);
  }

  async search(
    query: string,
    user: JwtPayload,
    teamId?: string,
    limit: number = 10,
  ): Promise<Player[]> {
    if (!query?.trim()) {
      return [];
    }

    const safeLimit = Math.min(Math.max(limit || 10, 1), 50);
    const queryBuilder = this.createAccessScopedQuery(user);

    if (teamId) {
      queryBuilder.andWhere('team.id = :teamId', { teamId });
    }

    queryBuilder.andWhere(
      '(LOWER(player.firstname) LIKE LOWER(:query) OR LOWER(player.lastname) LIKE LOWER(:query))',
      { query: `%${query}%` },
    );

    return queryBuilder
      .orderBy('player.lastname', 'ASC')
      .addOrderBy('player.firstname', 'ASC')
      .take(safeLimit)
      .getMany();
  }

  async autocomplete(
    query: string,
    user: JwtPayload,
    teamId?: string,
    limit: number = 10,
  ): Promise<Array<{ id: string; firstname: string; lastname: string; label: string }>> {
    const players = await this.search(query, user, teamId, limit);

    return players.map((player) => ({
      id: player.id,
      firstname: player.firstname,
      lastname: player.lastname,
      label: `${player.firstname} ${player.lastname}`,
    }));
  }
}
