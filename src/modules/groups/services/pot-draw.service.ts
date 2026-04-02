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

    const numGroups = dto.numberOfGroups;                 // output groups (A, B, C, ...)
    const numPots = numGroups;                            // rule: numPots = numGroups
    const teamsPerPot = Math.floor(totalTeams / numGroups); // base teams per pot
    const remainder = totalTeams % numGroups;             // extra teams spread across first pots

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
    //   - numPots = numGroups (one pot per output group)
    //   - Pots 1..remainder have (teamsPerPot + 1) teams each
    //   - Pots (remainder+1)..numPots have teamsPerPot teams each
    for (let i = 1; i <= numPots; i++) {
      const potTeams = potAssignments.get(i) || [];
      const expectedSize = i <= remainder ? teamsPerPot + 1 : teamsPerPot;
      if (potTeams.length !== expectedSize) {
        throw new BadRequestException(
          `Pot ${i} has ${potTeams.length} teams, but must have exactly ${expectedSize} teams.`,
        );
      }
    }

    // Output = numGroups groups (A, B, C, ...)
    const groupLetters = this.getGroupLetters(numGroups);
    const groups: { letter: string; teams: string[] }[] = groupLetters.map(
      (letter) => ({
        letter,
        teams: [],
      }),
    );

    // Distribution: circular assignment ensuring no two teams from the same pot
    // end up in the same group.
    //   Pot p contributes its K teams to groups: (p-1)%N, p%N, ..., (p-1+K-1)%N
    // This produces each group receiving exactly teamsPerPot (or teamsPerPot+1) teams
    // from distinct pots.
    for (let potNum = 1; potNum <= numPots; potNum++) {
      const potTeams = potAssignments.get(potNum) || [];
      for (let k = 0; k < potTeams.length; k++) {
        const groupIdx = (potNum - 1 + k) % numGroups;
        groups[groupIdx].teams.push(potTeams[k].registrationId);
      }
    }

    // Save groups to database
    const savedGroups: Group[] = [];
    for (const group of groups) {
      const groupEntity = this.groupRepository.create({
        tournamentId,
        ageGroupId: dto.ageGroupId,
        groupLetter: group.letter,
        teams: group.teams,
      });
      const saved = await this.groupRepository.save(groupEntity);
      savedGroups.push(saved);
    }

    // BE-32 Step 1 — Update registration.groupAssignment for every team placed in a group
    for (const group of savedGroups) {
      for (const teamId of group.teams) {
        await this.registrationRepository.update(teamId, {
          groupAssignment: group.groupLetter,
        });
      }
    }

    // BE-32 Step 2 — Auto-calculate numberOfMatches for this age group
    if (dto.ageGroupId) {
      await this.autoCalcNumberOfMatches(tournamentId, dto.ageGroupId, savedGroups);
    }

    // BE-32 Step 3 — Mark the specific age group draw as completed
    if (dto.ageGroupId) {
      await this.ageGroupRepository.update(dto.ageGroupId, { drawCompleted: true });
    }

    // Mark tournament as having completed draw
    tournament.drawCompleted = true;
    await this.tournamentRepository.save(tournament);

    return savedGroups;
  }

  /**
   * Auto-calculate numberOfMatches for an age group after pot draw.
   * Mirrors the same logic in GroupsService.autoCalcNumberOfMatches.
   */
  private async autoCalcNumberOfMatches(
    tournamentId: string,
    ageGroupId: string,
    groups: Group[],
  ): Promise<void> {
    try {
      const ageGroup = await this.ageGroupRepository.findOne({
        where: { id: ageGroupId, tournamentId },
      });
      if (!ageGroup) return;

      const numGroups = groups.length;
      if (numGroups === 0) return;

      const teamsPerGroup = Math.ceil(
        groups.reduce((s, g) => s + g.teams.length, 0) / numGroups,
      );

      // C(n, 2) = n*(n-1)/2 matches per group
      const groupMatches = numGroups * ((teamsPerGroup * (teamsPerGroup - 1)) / 2);
      const advancingPerGroup = ageGroup.qualifyingTeamsPerGroup ?? 2;
      const qualifyingTeams = numGroups * advancingPerGroup;
      const knockoutMatches = qualifyingTeams - 1;
      const total = groupMatches + knockoutMatches + 1; // +1 for third-place match

      await this.ageGroupRepository.update(ageGroupId, { numberOfMatches: total });
    } catch {
      // Non-critical — silently skip if calculation fails
    }
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