import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentPot } from '../entities/tournament-pot.entity';
import { Group } from '../entities/group.entity';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Registration } from '../../registrations/entities/registration.entity';
import { TournamentAgeGroup } from '../../tournaments/entities/tournament-age-group.entity';
import { AssignTeamToPotDto, AssignPotsBulkDto, ExecutePotDrawDto } from '../dto/pot.dto';
import { UserRole, RegistrationStatus, TournamentFormat } from '../../../common/enums';

@Injectable()
export class PotDrawService {
  constructor(
    @InjectRepository(TournamentPot)
    private readonly potRepository: Repository<TournamentPot>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(TournamentAgeGroup)
    private readonly ageGroupRepository: Repository<TournamentAgeGroup>,
  ) {}

  /**
   * Assign a single team to a pot
   */
  async assignTeamToPot(
    tournamentId: string,
    dto: AssignTeamToPotDto,
    userId?: string,
    userRole?: string,
  ): Promise<TournamentPot> {
    // Validate tournament exists and check authorization
    const tournament = await this.validateTournamentAccess(tournamentId, userId, userRole);

    // Validate registration exists and belongs to tournament
    const registration = await this.registrationRepository.findOne({
      where: { id: dto.registrationId, tournamentId },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found in this tournament');
    }

    // Only allow APPROVED registrations to be assigned to pots
    if (registration.status !== RegistrationStatus.APPROVED) {
      throw new BadRequestException('Only approved registrations can be assigned to pots');
    }

    // Check if team already assigned to a pot
    const existing = await this.potRepository.findOne({
      where: { tournamentId, registrationId: dto.registrationId },
    });

    if (existing) {
      // Update existing assignment
      existing.potNumber = dto.potNumber;
      return this.potRepository.save(existing);
    }

    // Create new assignment
    const pot = this.potRepository.create({
      tournamentId,
      registrationId: dto.registrationId,
      potNumber: dto.potNumber,
    });

    return this.potRepository.save(pot);
  }

  /**
   * Bulk assign teams to pots
   */
  async assignTeamsToPotsBulk(
    tournamentId: string,
    dto: AssignPotsBulkDto,
    userId?: string,
    userRole?: string,
  ): Promise<TournamentPot[]> {
    // Validate access first (before processing bulk assignments)
    await this.validateTournamentAccess(tournamentId, userId, userRole);

    const results: TournamentPot[] = [];

    for (const assignment of dto.assignments) {
      // No need to re-validate access for each assignment
      const pot = await this.assignTeamToPot(tournamentId, assignment);
      results.push(pot);
    }

    return results;
  }

  /**
   * Get all pot assignments for a tournament, optionally filtered by age group
   */
  async getPotAssignments(
    tournamentId: string,
    ageGroupId?: string,
  ): Promise<Map<number, TournamentPot[]>> {
    const queryBuilder = this.potRepository
      .createQueryBuilder('pot')
      .leftJoinAndSelect('pot.registration', 'registration')
      .leftJoinAndSelect('registration.club', 'club')
      .where('pot.tournamentId = :tournamentId', { tournamentId });

    if (ageGroupId) {
      queryBuilder.andWhere('registration.ageGroupId = :ageGroupId', { ageGroupId });
    }

    queryBuilder.orderBy('pot.potNumber', 'ASC').addOrderBy('pot.createdAt', 'ASC');

    const pots = await queryBuilder.getMany();

    // Dynamically determine max pot number from actual assignments
    const potMap = new Map<number, TournamentPot[]>();
    let maxPot = 0;
    for (const p of pots) {
      if (p.potNumber > maxPot) maxPot = p.potNumber;
    }
    // Always include at least pot 1
    if (maxPot < 1) maxPot = 1;
    for (let i = 1; i <= maxPot; i++) {
      potMap.set(i, pots.filter((p) => p.potNumber === i));
    }

    return potMap;
  }

  /**
   * Execute pot-based draw to create groups
   * Algorithm: Distribute teams evenly from each pot into groups
   */
  async executePotBasedDraw(
    tournamentId: string,
    dto: ExecutePotDrawDto,
    userId?: string,
    userRole?: string,
  ): Promise<Group[]> {
    // Validate tournament exists and check authorization
    const tournament = await this.validateTournamentAccess(tournamentId, userId, userRole, true);

    // BE-12 — Gate by age-group format
    if (dto.ageGroupId) {
      const ageGroup = await this.ageGroupRepository.findOne({
        where: { id: dto.ageGroupId, tournamentId },
      });
      if (ageGroup?.format) {
        switch (ageGroup.format) {
          case TournamentFormat.ROUND_ROBIN:
            throw new BadRequestException(
              'Pot draw is not applicable for ROUND_ROBIN format. Teams are assigned directly.',
            );
          case TournamentFormat.GROUPS_PLUS_KNOCKOUT:
            // Group-seeding pot draw — continue with existing logic below
            break;
          case TournamentFormat.SINGLE_ELIMINATION:
          case TournamentFormat.DOUBLE_ELIMINATION:
          case TournamentFormat.LEAGUE:
            // For SE/DE/LEAGUE the draw creates a seeding order, not group assignments.
            // The existing simple pot draw is repurposed here as a seeding draw.
            // Full seeding-order draw (FE-14) is a future enhancement.
            break;
        }
      }
    }

    // Check if draw already completed
    if (tournament.drawCompleted) {
      throw new BadRequestException('Draw has already been completed for this tournament');
    }

    // Filter registrations by age group if specified
    const allApprovedRegistrations = tournament.registrations.filter(
      (reg) => reg.status === RegistrationStatus.APPROVED,
    );
    const approvedRegistrations = dto.ageGroupId
      ? allApprovedRegistrations.filter((reg) => reg.ageGroupId === dto.ageGroupId)
      : allApprovedRegistrations;
    const totalTeams = approvedRegistrations.length;

    // Validate input
    if (totalTeams === 0) {
      throw new BadRequestException('No teams registered for this tournament');
    }

    if (dto.numberOfGroups < 1 || dto.numberOfGroups > totalTeams) {
      throw new BadRequestException(
        `Number of groups must be between 1 and ${totalTeams}`,
      );
    }

    const baseTeamsPerGroup = Math.floor(totalTeams / dto.numberOfGroups);
    const remainder = totalTeams % dto.numberOfGroups;
    const numFullPots = baseTeamsPerGroup;              // full pots, each with numberOfGroups teams
    const expectedTeamsPerFullPot = dto.numberOfGroups; // teams_per_pot = num_groups

    // Get pot assignments (filtered by age group if specified)
    const potAssignments = await this.getPotAssignments(tournamentId, dto.ageGroupId);

    // Validate all teams are assigned to pots
    let totalAssigned = 0;
    for (const teams of potAssignments.values()) {
      totalAssigned += teams.length;
    }

    if (totalAssigned !== totalTeams) {
      throw new BadRequestException(
        `Not all teams assigned to pots. Assigned: ${totalAssigned}, Total: ${totalTeams}`,
      );
    }

    // Validate pot structure:
    //   - Pots 1..numFullPots: each with exactly numberOfGroups teams
    //   - If remainder > 0: pot numFullPots+1 with exactly `remainder` teams
    for (let i = 1; i <= numFullPots; i++) {
      const potTeams = potAssignments.get(i) || [];
      if (potTeams.length !== expectedTeamsPerFullPot) {
        throw new BadRequestException(
          `Pot ${i} has ${potTeams.length} teams, but must have exactly ${expectedTeamsPerFullPot} ` +
          `(= number of groups). Each full pot must contain exactly as many teams as there are groups.`,
        );
      }
    }

    if (remainder > 0) {
      const remainderPotNum = numFullPots + 1;
      const remainderTeams = potAssignments.get(remainderPotNum) || [];
      if (remainderTeams.length !== remainder) {
        throw new BadRequestException(
          `Remainder pot (Pot ${remainderPotNum}) has ${remainderTeams.length} teams, ` +
          `but must have exactly ${remainder} teams (the remainder of ${totalTeams} ÷ ${dto.numberOfGroups}).`,
        );
      }
    }

    const nonEmptyPots: number[] = [];
    for (const [potNum, teams] of potAssignments.entries()) {
      if (teams.length > 0) nonEmptyPots.push(potNum);
    }

    // Initialize groups with their letters
    const groupLetters = this.getGroupLetters(dto.numberOfGroups);
    const groups: { letter: string; teams: string[] }[] = groupLetters.map(
      (letter) => ({
        letter,
        teams: [],
      }),
    );

    // Sort pot numbers so we process Pot 1 first, Pot 2 second, etc.
    nonEmptyPots.sort((a, b) => a - b);

    // Shuffle within each pot for randomness
    const shuffledPots = new Map<number, TournamentPot[]>();
    for (const potNum of nonEmptyPots) {
      const potTeams = potAssignments.get(potNum) || [];
      shuffledPots.set(
        potNum,
        this.seededShuffle([...potTeams], tournamentId + potNum),
      );
    }

    // Distribution:
    //   Full pots (1..numFullPots): each group receives exactly 1 team per pot.
    //   Remainder pot (numFullPots+1, if exists): its teams go to randomly
    //   chosen groups, so `remainder` groups get one extra team.
    for (let potNum = 1; potNum <= numFullPots; potNum++) {
      const potTeams = shuffledPots.get(potNum)!;
      for (let g = 0; g < dto.numberOfGroups; g++) {
        groups[g].teams.push(potTeams[g].registrationId);
      }
    }

    // Distribute remainder pot teams to randomly selected groups
    if (remainder > 0) {
      const remainderPotNum = numFullPots + 1;
      const remainderTeams = shuffledPots.get(remainderPotNum)!;
      // Randomly pick which groups get the extra team
      const groupIndices = Array.from({ length: dto.numberOfGroups }, (_, i) => i);
      const shuffledGroupIndices = this.seededShuffle(groupIndices, tournamentId + 'remainder');
      for (let i = 0; i < remainder; i++) {
        groups[shuffledGroupIndices[i]].teams.push(remainderTeams[i].registrationId);
      }
    }

    // Save groups to database
    const savedGroups: Group[] = [];
    for (const group of groups) {
      const groupEntity = this.groupRepository.create({
        tournamentId,
        groupLetter: group.letter,
        teams: group.teams,
      });
      const saved = await this.groupRepository.save(groupEntity);
      savedGroups.push(saved);
    }

    // Mark tournament as having completed draw
    tournament.drawCompleted = true;
    await this.tournamentRepository.save(tournament);

    return savedGroups;
  }

  /**
   * Clear pot assignments for a tournament, optionally filtered by age group
   */
  async clearPotAssignments(
    tournamentId: string,
    userId?: string,
    userRole?: string,
    ageGroupId?: string,
  ): Promise<void> {
    // Validate access
    await this.validateTournamentAccess(tournamentId, userId, userRole);

    if (ageGroupId) {
      // Delete only pots for registrations in this age group
      await this.potRepository
        .createQueryBuilder()
        .delete()
        .from(TournamentPot)
        .where('tournament_id = :tournamentId', { tournamentId })
        .andWhere(
          'registration_id IN (SELECT id FROM registrations WHERE tournament_id = :tournamentId AND age_group_id = :ageGroupId)',
          { tournamentId, ageGroupId },
        )
        .execute();
    } else {
      await this.potRepository.delete({ tournamentId });
    }
  }

  /**
   * Validate pot distribution, optionally filtered by age group
   */
  async validatePotDistribution(
    tournamentId: string,
    expectedTeamsPerPot?: number,
    ageGroupId?: string,
  ): Promise<{ valid: boolean; message: string; potCounts: Map<number, number> }> {
    const potAssignments = await this.getPotAssignments(tournamentId, ageGroupId);
    const potCounts = new Map<number, number>();
    let totalTeams = 0;

    for (const [potNum, teams] of potAssignments.entries()) {
      potCounts.set(potNum, teams.length);
      totalTeams += teams.length;
    }

    if (expectedTeamsPerPot) {
      for (const [, count] of potCounts.entries()) {
        if (count !== expectedTeamsPerPot && count !== 0) {
          return {
            valid: false,
            message: `Uneven pot distribution. Expected ${expectedTeamsPerPot} per pot, got ${count}`,
            potCounts,
          };
        }
      }
    }

    return {
      valid: true,
      message: `Total teams assigned: ${totalTeams}`,
      potCounts,
    };
  }

  /**
   * Get group letters (A, B, C, D, etc.)
   */
  private getGroupLetters(count: number): string[] {
    const letters: string[] = [];
    for (let i = 0; i < count; i++) {
      letters.push(String.fromCharCode(65 + i)); // A = 65
    }
    return letters;
  }

  /**
   * Validate tournament access and authorization
   * @param tournamentId Tournament ID
   * @param userId User ID (optional for read-only operations)
   * @param userRole User role (optional for read-only operations)
   * @param loadRelations Whether to load registrations relation
   * @returns Tournament entity
   */
  private async validateTournamentAccess(
    tournamentId: string,
    userId?: string,
    userRole?: string,
    loadRelations = false,
  ): Promise<Tournament> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
      relations: loadRelations ? ['registrations'] : [],
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Authorization check: only organizer or admin can modify pots
    if (userId && userRole) {
      if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'You are not allowed to manage pots for this tournament',
        );
      }
    }

    return tournament;
  }

  /**
   * Seeded shuffle for deterministic randomness
   */
  private seededShuffle<T>(array: T[], seed: string): T[] {
    const result = [...array];
    let hash = this.hashString(seed);

    for (let i = result.length - 1; i > 0; i--) {
      hash = (hash * 9301 + 49297) % 233280;
      const j = Math.floor((hash / 233280) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  /**
   * Simple hash function for seed
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
