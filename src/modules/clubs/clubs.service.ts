import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Club } from './entities/club.entity';
import {
  CreateClubDto,
  UpdateClubDto,
  ClubFilterDto,
  AdminUpdateClubDto,
} from './dto';
import { PaginationDto } from '../../common/dto';
import { PaginatedResponse } from '../../common/interfaces';
import { UserRole } from '../../common/enums';

@Injectable()
export class ClubsService {
  constructor(
    @InjectRepository(Club)
    private clubsRepository: Repository<Club>,
  ) {}

  async create(
    organizerId: string,
    createClubDto: CreateClubDto,
  ): Promise<Club> {
    // Check if club with same name already exists
    const existingClub = await this.clubsRepository.findOne({
      where: { name: createClubDto.name },
    });

    if (existingClub) {
      throw new ConflictException('Club with this name already exists');
    }

    const club = this.clubsRepository.create({
      ...createClubDto,
      organizerId,
    });

    return this.clubsRepository.save(club);
  }

  async findAll(
    pagination: PaginationDto,
    filters?: ClubFilterDto,
  ): Promise<PaginatedResponse<Club>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.clubsRepository
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.organizer', 'organizer');

    if (filters?.country) {
      queryBuilder.andWhere('club.country = :country', {
        country: filters.country,
      });
    }

    if (filters?.city) {
      queryBuilder.andWhere('club.city = :city', { city: filters.city });
    }

    if (filters?.isVerified !== undefined) {
      queryBuilder.andWhere('club.isVerified = :isVerified', {
        isVerified: filters.isVerified,
      });
    }

    if (filters?.isPremium !== undefined) {
      queryBuilder.andWhere('club.isPremium = :isPremium', {
        isPremium: filters.isPremium,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(LOWER(club.name) LIKE LOWER(:search) OR LOWER(club.city) LIKE LOWER(:search))',
        { search: `%${filters.search}%` },
      );
    }

    const [clubs, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('club.name', 'ASC')
      .getManyAndCount();

    return {
      data: clubs,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string): Promise<Club | null> {
    return this.clubsRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
  }

  async findByIdOrFail(id: string): Promise<Club> {
    const club = await this.findById(id);

    if (!club) {
      throw new NotFoundException(`Club with ID ${id} not found`);
    }

    return club;
  }

  async findByOrganizer(organizerId: string): Promise<Club[]> {
    return this.clubsRepository.find({
      where: { organizerId },
      order: { name: 'ASC' },
    });
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    updateClubDto: UpdateClubDto,
  ): Promise<Club> {
    const club = await this.findByIdOrFail(id);

    // Only the organizer or admin can update the club
    if (club.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not allowed to update this club');
    }

    // Check if name is being changed and if it conflicts
    if (updateClubDto.name && updateClubDto.name !== club.name) {
      const existingClub = await this.clubsRepository.findOne({
        where: { name: updateClubDto.name },
      });

      if (existingClub) {
        throw new ConflictException('Club with this name already exists');
      }
    }

    Object.assign(club, updateClubDto);

    return this.clubsRepository.save(club);
  }

  async adminUpdate(
    id: string,
    adminUpdateClubDto: AdminUpdateClubDto,
  ): Promise<Club> {
    const club = await this.findByIdOrFail(id);

    Object.assign(club, adminUpdateClubDto);

    return this.clubsRepository.save(club);
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const club = await this.findByIdOrFail(id);

    // Only the organizer or admin can delete the club
    if (club.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not allowed to delete this club');
    }

    await this.clubsRepository.remove(club);
  }

  async verify(id: string): Promise<Club> {
    const club = await this.findByIdOrFail(id);
    club.isVerified = true;
    return this.clubsRepository.save(club);
  }

  async unverify(id: string): Promise<Club> {
    const club = await this.findByIdOrFail(id);
    club.isVerified = false;
    return this.clubsRepository.save(club);
  }

  async setPremium(id: string, isPremium: boolean): Promise<Club> {
    const club = await this.findByIdOrFail(id);
    club.isPremium = isPremium;
    return this.clubsRepository.save(club);
  }

  async getStatistics(): Promise<{
    totalClubs: number;
    verifiedClubs: number;
    premiumClubs: number;
    clubsByCountry: Record<string, number>;
  }> {
    const totalClubs = await this.clubsRepository.count();
    const verifiedClubs = await this.clubsRepository.count({
      where: { isVerified: true },
    });
    const premiumClubs = await this.clubsRepository.count({
      where: { isPremium: true },
    });

    const countryStats = await this.clubsRepository
      .createQueryBuilder('club')
      .select('club.country', 'country')
      .addSelect('COUNT(*)', 'count')
      .groupBy('club.country')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalClubs,
      verifiedClubs,
      premiumClubs,
      clubsByCountry: countryStats.reduce(
        (acc, item) => ({ ...acc, [item.country]: parseInt(item.count, 10) }),
        {},
      ),
    };
  }

  async searchClubs(query: string, limit: number = 10): Promise<Club[]> {
    return this.clubsRepository
      .createQueryBuilder('club')
      .where('LOWER(club.name) LIKE LOWER(:query)', { query: `%${query}%` })
      .orWhere('LOWER(club.city) LIKE LOWER(:query)', { query: `%${query}%` })
      .orderBy('club.isVerified', 'DESC')
      .addOrderBy('club.name', 'ASC')
      .take(limit)
      .getMany();
  }
}
