import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentPot } from '../entities/tournament-pot.entity';
import { Group } from '../entities/group.entity';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Registration } from '../../registrations/entities/registration.entity';
import { AssignTeamToPotDto, AssignPotsBulkDto, ExecutePotDrawDto } from '../dto/pot.dto';
import { UserRole, RegistrationStatus } from '../../../common/enums';

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
   * Get all pot assignments for a tournament
   */
  async getPotAssignments(
    tournamentId: string,
  ): Promise<Map<number, TournamentPot[]>> {
    const pots = await this.potRepository.find({
      where: { tournamentId },
      relations: ['registration', 'registration.club'],
      order: { potNumber: 'ASC', createdAt: 'ASC' },
    });

    const potMap = new Map<number, TournamentPot[]>();
    for (let i = 1; i <= 4; i++) {
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

    // Check if draw already completed
    if (tournament.drawCompleted) {
      throw new BadRequestException('Draw has already been completed for this tournament');
    }

    // Only count approved registrations for the draw
    const approvedRegistrations = tournament.registrations.filter(
      (reg) => reg.status === RegistrationStatus.APPROVED,
    );
    const totalTeams = approvedRegistrations.length;

    // Validate input
    if (totalTeams === 0) {
      throw new BadRequestException('No teams registered for this tournament');
    }

    if (dto.numberOfGroups < 2 || dto.numberOfGroups > totalTeams) {
      throw new BadRequestException(
        `Number of groups must be between 2 and ${totalTeams}`,
      );
    }

    // Get pot assignments
    const potAssignments = await this.getPotAssignments(tournamentId);

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

    // Initialize groups with their letters
    const groupLetters = this.getGroupLetters(dto.numberOfGroups);
    const groups: { letter: string; teams: string[] }[] = groupLetters.map(
      (letter) => ({
        letter,
        teams: [],
      }),
    );

    // Execute pot-based distribution with snake draft pattern
    // Shuffle within each pot for randomness
    const shuffledPots = new Map<number, TournamentPot[]>();
    for (let potNum = 1; potNum <= 4; potNum++) {
      const potTeams = potAssignments.get(potNum) || [];
      if (potTeams.length > 0) {
        shuffledPots.set(
          potNum,
          this.seededShuffle([...potTeams], tournamentId + potNum),
        );
      }
    }

    // Distribute teams using snake draft pattern
    // This ensures balanced distribution even with uneven pot sizes
    let groupIdx = 0;
    let direction = 1; // 1 for forward, -1 for backward (snake pattern)
    let teamIndex = new Map<number, number>(); // Track which team in each pot
    
    // Initialize team indices
    for (const potNum of [1, 2, 3, 4]) {
      teamIndex.set(potNum, 0);
    }

    // Continue until all teams are assigned
    let assignedTeams = 0;
    while (assignedTeams < totalTeams) {
      // Try to assign one team from each pot to the current group
      for (const potNum of [1, 2, 3, 4]) {
        const potTeams = shuffledPots.get(potNum);
        const idx = teamIndex.get(potNum);
        
        if (potTeams && idx !== undefined && idx < potTeams.length && groupIdx < dto.numberOfGroups) {
          const team = potTeams[idx];
          groups[groupIdx].teams.push(team.registrationId);
          teamIndex.set(potNum, idx + 1);
          assignedTeams++;
          
          // Move to next group
          groupIdx += direction;
          
          // Handle snake pattern (reverse direction at ends)
          if (groupIdx >= dto.numberOfGroups) {
            groupIdx = dto.numberOfGroups - 1;
            direction = -1;
          } else if (groupIdx < 0) {
            groupIdx = 0;
            direction = 1;
          }
        }
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
   * Clear all pot assignments for a tournament
   */
  async clearPotAssignments(
    tournamentId: string,
    userId?: string,
    userRole?: string,
  ): Promise<void> {
    // Validate access
    await this.validateTournamentAccess(tournamentId, userId, userRole);
    await this.potRepository.delete({ tournamentId });
  }

  /**
   * Validate pot distribution
   */
  async validatePotDistribution(
    tournamentId: string,
    expectedTeamsPerPot?: number,
  ): Promise<{ valid: boolean; message: string; potCounts: Map<number, number> }> {
    const potAssignments = await this.getPotAssignments(tournamentId);
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
