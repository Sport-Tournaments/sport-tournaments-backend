import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Club } from '../clubs/entities/club.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { UserRole, RegistrationStatus } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Club)
    private clubsRepository: Repository<Club>,
    @InjectRepository(Registration)
    private registrationsRepository: Repository<Registration>,
  ) {}

  async getSummary(user: JwtPayload) {
    const [recentTournaments, recentClubs] = await Promise.all([
      this.tournamentsRepository.find({
        where: { organizerId: user.sub },
        relations: ['ageGroups'],
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.clubsRepository.find({
        where: { organizerId: user.sub },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    const [tournamentsCount, clubsCount] = await Promise.all([
      this.tournamentsRepository.count({ where: { organizerId: user.sub } }),
      this.clubsRepository.count({ where: { organizerId: user.sub } }),
    ]);

    const recentRegistrations = await this.getRecentRegistrations(user);
    const registrationStats = await this.getRegistrationStats(user);

    return {
      stats: {
        tournaments: tournamentsCount,
        clubs: clubsCount,
        registrations: registrationStats.total,
        approved: registrationStats.approved,
        pending: registrationStats.pending,
      },
      recentTournaments,
      recentClubs,
      recentRegistrations,
    };
  }

  private async getRecentRegistrations(
    user: JwtPayload,
  ): Promise<Registration[]> {
    const queryBuilder = this.registrationsRepository
      .createQueryBuilder('registration')
      .leftJoinAndSelect('registration.club', 'club')
      .leftJoinAndSelect('registration.team', 'team')
      .leftJoinAndSelect('registration.tournament', 'tournament')
      .leftJoinAndSelect('registration.ageGroup', 'ageGroup')
      .orderBy('registration.registrationDate', 'DESC')
      .take(5);

    if (user.role === UserRole.ORGANIZER || user.role === UserRole.ADMIN) {
      queryBuilder.where('tournament.organizerId = :userId', {
        userId: user.sub,
      });
      return queryBuilder.getMany();
    }

    const clubIds = await this.getUserClubIds(user.sub);
    if (clubIds.length === 0) return [];

    return queryBuilder
      .where('registration.clubId IN (:...clubIds)', { clubIds })
      .getMany();
  }

  private async getRegistrationStats(user: JwtPayload) {
    const queryBuilder = this.registrationsRepository
      .createQueryBuilder('registration')
      .select('registration.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('registration.status');

    if (user.role === UserRole.ORGANIZER || user.role === UserRole.ADMIN) {
      queryBuilder
        .innerJoin('registration.tournament', 'tournament')
        .where('tournament.organizerId = :userId', { userId: user.sub });
    } else {
      const clubIds = await this.getUserClubIds(user.sub);
      if (clubIds.length === 0) {
        return { total: 0, approved: 0, pending: 0 };
      }
      queryBuilder.where('registration.clubId IN (:...clubIds)', { clubIds });
    }

    const rows = await queryBuilder.getRawMany<{
      status: RegistrationStatus;
      count: string;
    }>();
    const counts = rows.reduce(
      (acc, row) => {
        const count = parseInt(row.count, 10) || 0;
        acc.total += count;
        if (row.status === RegistrationStatus.APPROVED) acc.approved += count;
        if (
          row.status === RegistrationStatus.PENDING ||
          row.status === RegistrationStatus.PENDING_PAYMENT
        ) {
          acc.pending += count;
        }
        return acc;
      },
      { total: 0, approved: 0, pending: 0 },
    );

    return counts;
  }

  private async getUserClubIds(userId: string): Promise<string[]> {
    const clubs = await this.clubsRepository.find({
      where: { organizerId: userId },
      select: ['id'],
    });
    return clubs.map((club) => club.id);
  }
}
