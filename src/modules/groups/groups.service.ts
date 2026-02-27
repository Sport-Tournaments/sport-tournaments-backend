import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Group } from './entities/group.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentAgeGroup } from '../tournaments/entities/tournament-age-group.entity';
import { Registration } from '../registrations/entities/registration.entity';
import { ExecuteDrawDto, UpdateBracketDto, CreateGroupDto, ConfigureGroupsDto, UpdateGroupDto, GroupConfigurationResponseDto, UpdateMatchAdvancementDto, UpdateMatchScoreDto } from './dto';
import {
  TournamentStatus,
  RegistrationStatus,
  UserRole,
  TournamentFormat,
} from '../../common/enums';
import { BracketGeneratorService, BracketType, Match } from './services/bracket-generator.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupsRepository: Repository<Group>,
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(TournamentAgeGroup)
    private ageGroupRepository: Repository<TournamentAgeGroup>,
    @InjectRepository(Registration)
    private registrationsRepository: Repository<Registration>,
    private bracketGeneratorService: BracketGeneratorService,
  ) {}

  async executeDraw(
    tournamentId: string,
    userId: string,
    userRole: string,
    executeDrawDto: ExecuteDrawDto,
  ): Promise<Group[]> {
    // Get tournament
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to execute the draw for this tournament',
      );
    }

    // Check if draw already completed
    if (tournament.drawCompleted) {
      throw new BadRequestException(
        'Draw has already been completed for this tournament',
      );
    }

    // Check tournament status
    if (
      tournament.status !== TournamentStatus.PUBLISHED &&
      tournament.status !== TournamentStatus.ONGOING
    ) {
      throw new BadRequestException(
        'Can only execute draw for published or ongoing tournaments',
      );
    }

    // Get approved registrations
    const registrations = await this.registrationsRepository.find({
      where: {
        tournamentId,
        status: RegistrationStatus.APPROVED,
      },
      relations: ['club'],
    });

    if (registrations.length < 2) {
      throw new BadRequestException(
        'At least 2 approved teams are required for the draw',
      );
    }

    // Calculate number of groups
    const numberOfGroups =
      executeDrawDto.numberOfGroups || Math.ceil(registrations.length / 4); // Default: max 4 teams per group

    if (numberOfGroups > registrations.length) {
      throw new BadRequestException(
        'Number of groups cannot exceed number of teams',
      );
    }

    // Generate seed
    const seed = executeDrawDto.seed || randomUUID();

    // Shuffle registrations using seeded random
    const shuffledRegistrations = this.seededShuffle([...registrations], seed);

    // Create groups
    const groups: Group[] = [];
    const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // Delete existing groups
    await this.groupsRepository.delete({ tournamentId });

    for (let i = 0; i < numberOfGroups; i++) {
      const group = this.groupsRepository.create({
        tournamentId,
        groupLetter: groupLetters[i],
        teams: [],
        groupOrder: i + 1,
      });
      groups.push(group);
    }

    // Distribute teams to groups (snake draft)
    shuffledRegistrations.forEach((registration, index) => {
      const groupIndex = index % numberOfGroups;
      groups[groupIndex].teams.push(registration.id);
    });

    // Save groups
    const savedGroups = await this.groupsRepository.save(groups);

    // Update registrations with group assignments
    for (const group of savedGroups) {
      for (const teamId of group.teams) {
        await this.registrationsRepository.update(teamId, {
          groupAssignment: group.groupLetter,
        });
      }
    }

    // Mark draw as completed
    await this.tournamentsRepository.update(tournamentId, {
      drawCompleted: true,
      drawSeed: seed,
    });

    // BE-08 — auto-calculate numberOfMatches for affected age groups
    const ageGroupIds = [...new Set(registrations.map((r) => r.ageGroupId).filter(Boolean))];
    for (const agId of ageGroupIds) {
      await this.autoCalcNumberOfMatches(tournamentId, agId!, savedGroups.filter(g => g.teams.some(t => registrations.find(r => r.id === t)?.ageGroupId === agId)));
    }

    return savedGroups;
  }

  async getGroups(tournamentId: string): Promise<Group[]> {
    const groups = await this.groupsRepository.find({
      where: { tournamentId },
      order: { groupOrder: 'ASC' },
    });

    // Populate team details
    for (const group of groups) {
      // Replace team IDs with full registration data
      (group as any).teamDetails = await Promise.all(
        group.teams.map(async (teamId) => {
          const registration = await this.registrationsRepository.findOne({
            where: { id: teamId },
            relations: ['club'],
          });
          return registration;
        }),
      );
    }

    return groups;
  }

  async getBracket(tournamentId: string): Promise<{
    groups: Group[];
    tournament: Tournament;
    drawCompleted: boolean;
  }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const groups = await this.getGroups(tournamentId);

    return {
      groups,
      tournament,
      drawCompleted: tournament.drawCompleted,
    };
  }

  async updateBracket(
    tournamentId: string,
    userId: string,
    userRole: string,
    updateBracketDto: UpdateBracketDto,
  ): Promise<Group[]> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to update the bracket for this tournament',
      );
    }

    // Update each assignment
    for (const assignment of updateBracketDto.assignments) {
      const registration = await this.registrationsRepository.findOne({
        where: { id: assignment.registrationId, tournamentId },
      });

      if (!registration) {
        throw new NotFoundException(
          `Registration ${assignment.registrationId} not found`,
        );
      }

      // Update registration's group assignment
      await this.registrationsRepository.update(assignment.registrationId, {
        groupAssignment: assignment.groupLetter,
      });
    }

    // Rebuild groups based on updated assignments
    const registrations = await this.registrationsRepository.find({
      where: {
        tournamentId,
        status: RegistrationStatus.APPROVED,
      },
    });

    // Get unique group letters
    const groupLetters = [
      ...new Set(
        registrations
          .filter((r) => r.groupAssignment)
          .map((r) => r.groupAssignment),
      ),
    ].sort();

    // Delete and recreate groups
    await this.groupsRepository.delete({ tournamentId });

    const newGroups: Group[] = [];
    for (let i = 0; i < groupLetters.length; i++) {
      const letter = groupLetters[i];
      const teamsInGroup = registrations
        .filter((r) => r.groupAssignment === letter)
        .map((r) => r.id);

      const group = this.groupsRepository.create({
        tournamentId,
        groupLetter: letter,
        teams: teamsInGroup,
        groupOrder: i + 1,
      });
      newGroups.push(group);
    }

    return this.groupsRepository.save(newGroups);
  }

  async resetDraw(
    tournamentId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to reset the draw for this tournament',
      );
    }

    // Delete all groups
    await this.groupsRepository.delete({ tournamentId });

    // Clear group assignments from registrations
    await this.registrationsRepository.update(
      { tournamentId },
      { groupAssignment: undefined as unknown as string },
    );

    // Reset draw status
    tournament.drawCompleted = false;
    tournament.drawSeed = undefined;
    await this.tournamentsRepository.save(tournament);
  }

  async createGroup(
    tournamentId: string,
    userId: string,
    userRole: string,
    createGroupDto: CreateGroupDto,
  ): Promise<Group> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to create groups for this tournament',
      );
    }

    // Check if group with same letter exists
    const existingGroup = await this.groupsRepository.findOne({
      where: { tournamentId, groupLetter: createGroupDto.groupLetter },
    });

    if (existingGroup) {
      throw new BadRequestException(
        `Group ${createGroupDto.groupLetter} already exists`,
      );
    }

    const group = this.groupsRepository.create({
      tournamentId,
      ...createGroupDto,
      teams: createGroupDto.teams || [],
    });

    return this.groupsRepository.save(group);
  }

  // =====================================================
  // Manual Group Configuration methods (Issue #41)
  // =====================================================

  async configureGroups(
    tournamentId: string,
    userId: string,
    userRole: string,
    dto: ConfigureGroupsDto,
  ): Promise<GroupConfigurationResponseDto> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to configure groups for this tournament',
      );
    }

    // Get approved registrations count
    const registeredTeamsCount = await this.registrationsRepository.count({
      where: {
        tournamentId,
        status: RegistrationStatus.APPROVED,
      },
    });

    // Validation
    const errors: string[] = [];
    
    // Validate number of groups matches teamsPerGroup array length
    if (dto.numberOfGroups !== dto.teamsPerGroup.length) {
      errors.push(
        `Number of groups (${dto.numberOfGroups}) must match teamsPerGroup array length (${dto.teamsPerGroup.length})`,
      );
    }

    // Validate each group has at least 1 team
    dto.teamsPerGroup.forEach((group) => {
      if (group.teamCount < 1) {
        errors.push(`Group ${group.groupLetter} must have at least 1 team`);
      }
    });

    // Calculate total teams allocated
    const totalTeamsAllocated = dto.teamsPerGroup.reduce(
      (sum, group) => sum + group.teamCount,
      0,
    );

    // Validate total teams matches registered teams
    if (totalTeamsAllocated !== registeredTeamsCount) {
      errors.push(
        `Total teams allocated (${totalTeamsAllocated}) must equal total registered teams (${registeredTeamsCount})`,
      );
    }

    // Validate unique group letters
    const groupLetters = dto.teamsPerGroup.map((g) => g.groupLetter);
    const uniqueLetters = new Set(groupLetters);
    if (groupLetters.length !== uniqueLetters.size) {
      errors.push('Group letters must be unique');
    }

    const isValid = errors.length === 0;

    // If validation passes, save configuration
    if (isValid) {
      tournament.numberOfGroups = dto.numberOfGroups;
      tournament.groupConfiguration = dto.teamsPerGroup;
      tournament.groupConfigCreatedAt = new Date();
      await this.tournamentsRepository.save(tournament);

      // Create empty groups based on configuration
      const existingGroups = await this.groupsRepository.find({
        where: { tournamentId },
      });

      // Delete existing groups if any
      if (existingGroups.length > 0) {
        await this.groupsRepository.delete({ tournamentId });
      }

      // Create new groups
      const newGroups = dto.teamsPerGroup.map((config, index) =>
        this.groupsRepository.create({
          tournamentId,
          groupLetter: config.groupLetter,
          teams: [],
          groupOrder: index,
        }),
      );

      await this.groupsRepository.save(newGroups);
    }

    return {
      tournamentId,
      numberOfGroups: dto.numberOfGroups,
      teamsPerGroup: dto.teamsPerGroup,
      totalTeamsAllocated,
      totalRegisteredTeams: registeredTeamsCount,
      isValid,
      errors,
      createdAt: tournament.groupConfigCreatedAt || new Date(),
    };
  }

  async getGroupConfiguration(
    tournamentId: string,
  ): Promise<GroupConfigurationResponseDto> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (!tournament.numberOfGroups || !tournament.groupConfiguration) {
      throw new NotFoundException('No group configuration found for this tournament');
    }

    // Get approved registrations count
    const registeredTeamsCount = await this.registrationsRepository.count({
      where: {
        tournamentId,
        status: RegistrationStatus.APPROVED,
      },
    });

    // Calculate total teams allocated
    const totalTeamsAllocated = tournament.groupConfiguration.reduce(
      (sum, group) => sum + group.teamCount,
      0,
    );

    // Validation
    const errors: string[] = [];
    if (totalTeamsAllocated !== registeredTeamsCount) {
      errors.push(
        `Configuration out of sync: ${totalTeamsAllocated} allocated vs ${registeredTeamsCount} registered`,
      );
    }

    const isValid = errors.length === 0;

    return {
      tournamentId,
      numberOfGroups: tournament.numberOfGroups,
      teamsPerGroup: tournament.groupConfiguration,
      totalTeamsAllocated,
      totalRegisteredTeams: registeredTeamsCount,
      isValid,
      errors,
      createdAt: tournament.groupConfigCreatedAt || tournament.createdAt,
    };
  }

  async updateGroup(
    tournamentId: string,
    groupId: string,
    userId: string,
    userRole: string,
    dto: UpdateGroupDto,
  ): Promise<Group> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to update groups for this tournament',
      );
    }

    const group = await this.groupsRepository.findOne({
      where: { id: groupId, tournamentId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Validate teams exist if provided
    if (dto.teams && dto.teams.length > 0) {
      const registrations = await this.registrationsRepository.find({
        where: {
          tournamentId,
          status: RegistrationStatus.APPROVED,
        },
      });

      const validRegistrationIds = registrations.map((r) => r.id);
      const invalidTeams = dto.teams.filter(
        (teamId) => !validRegistrationIds.includes(teamId),
      );

      if (invalidTeams.length > 0) {
        throw new BadRequestException(
          `Invalid registration IDs: ${invalidTeams.join(', ')}`,
        );
      }

      // Check if configuration exists and validate team count
      if (tournament.groupConfiguration) {
        const groupConfig = tournament.groupConfiguration.find(
          (g) => g.groupLetter === group.groupLetter,
        );
        
        if (groupConfig && dto.teams.length > groupConfig.teamCount) {
          throw new BadRequestException(
            `Group ${group.groupLetter} can only have ${groupConfig.teamCount} teams (tried to assign ${dto.teams.length})`,
          );
        }
      }

      group.teams = dto.teams;
    }

    if (dto.groupLetter !== undefined) {
      // Check if new letter conflicts with existing groups
      const existingGroup = await this.groupsRepository.findOne({
        where: { tournamentId, groupLetter: dto.groupLetter },
      });

      if (existingGroup && existingGroup.id !== groupId) {
        throw new BadRequestException(
          `Group ${dto.groupLetter} already exists`,
        );
      }

      group.groupLetter = dto.groupLetter;
    }

    return this.groupsRepository.save(group);
  }

  // =====================================================
  // Match Management & Advancement Methods (Issue #173)
  // =====================================================

  /**
   * Helper to retrieve bracket data for a specific age group.
   * Supports both per-age-group format { [ageGroupId]: bracketData }
   * and legacy flat format (playoffRounds at top level).
   */
  private getBracketForAgeGroup(bracketData: any, ageGroupId?: string): any | null {
    if (!bracketData) return null;

    // New format: keyed by ageGroupId
    if (ageGroupId && bracketData[ageGroupId]) {
      return bracketData[ageGroupId];
    }

    // Legacy flat format: has playoffRounds or matches at top level
    // Return flat data even when ageGroupId is requested – the flat format
    // pre-dates per-age-group keying and is the only bracket available.
    if (bracketData.playoffRounds || bracketData.matches || bracketData.type) {
      return bracketData;
    }

    // No ageGroupId requested - return all brackets merged
    if (!ageGroupId) {
      // If it's a per-age-group map, merge all
      const keys = Object.keys(bracketData);
      if (keys.length > 0 && bracketData[keys[0]]?.playoffRounds) {
        const allRounds: any[] = [];
        const allMatches: any[] = [];
        let bracketType: string | undefined;
        for (const key of keys) {
          const bd = bracketData[key];
          if (bd.playoffRounds) allRounds.push(...bd.playoffRounds);
          if (bd.matches) allMatches.push(...bd.matches);
          if (bd.type) bracketType = bd.type;
        }
        return { playoffRounds: allRounds, matches: allMatches, type: bracketType };
      }
    }

    return null;
  }

  /**
   * Searches bracketData (playoffRounds[].matches and top-level matches) for a
   * match with the given matchId. Returns the match object reference so callers
   * can mutate it in-place.
   */
  private findMatchInBracket(bracketData: any, matchId: string): any | null {
    if (!bracketData) return null;

    // Search inside playoffRounds
    if (Array.isArray(bracketData.playoffRounds)) {
      for (const round of bracketData.playoffRounds) {
        if (Array.isArray(round.matches)) {
          const match = round.matches.find((m: any) => m.id === matchId);
          if (match) return match;
        }
      }
    }

    // Search top-level matches array
    if (Array.isArray(bracketData.matches)) {
      const match = bracketData.matches.find((m: any) => m.id === matchId);
      if (match) return match;
    }

    return null;
  }

  async getMatches(tournamentId: string, ageGroupId?: string): Promise<{
    matches: Match[];
    bracketType?: string;
    playoffRounds?: any[];
    teams: { id: string; name: string; clubName?: string }[];
  }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Get team details for display - filter by ageGroupId if provided
    const regWhere: any = { tournamentId, status: RegistrationStatus.APPROVED };
    if (ageGroupId) {
      regWhere.ageGroupId = ageGroupId;
    }

    const registrations = await this.registrationsRepository.find({
      where: regWhere,
      relations: ['club'],
    });

    const teams = registrations.map((r) => ({
      id: r.id,
      name: r.club?.name || r.coachName || 'Unknown Team',
      clubName: r.club?.name,
    }));

    if (!tournament.bracketData) {
      return { matches: [], teams };
    }

    const ageBracket = this.getBracketForAgeGroup(tournament.bracketData, ageGroupId);
    if (!ageBracket) {
      return { matches: [], teams };
    }

    const allMatches: Match[] = [];

    // Collect matches from playoff rounds
    if (ageBracket.playoffRounds) {
      for (const round of ageBracket.playoffRounds) {
        if (round.matches) {
          allMatches.push(...round.matches);
        }
      }
    }

    // Collect standalone matches
    if (ageBracket.matches) {
      allMatches.push(...ageBracket.matches);
    }

    return {
      matches: allMatches,
      bracketType: ageBracket.type,
      playoffRounds: ageBracket.playoffRounds,
      teams,
    };
  }

  async setMatchAdvancement(
    tournamentId: string,
    matchId: string,
    userId: string,
    userRole: string,
    dto: UpdateMatchAdvancementDto,
    ageGroupId?: string,
  ): Promise<{ match: Match; bracketUpdated: boolean }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to manage matches for this tournament',
      );
    }

    if (!tournament.bracketData) {
      throw new BadRequestException('No bracket data found for this tournament');
    }

    const fullBracketData = tournament.bracketData as any;
    const bracketData = this.getBracketForAgeGroup(fullBracketData, ageGroupId) || fullBracketData;
    let targetMatch: Match | null = null;
    let bracketUpdated = false;

    // Find the match in playoff rounds
    if (bracketData.playoffRounds) {
      for (const round of bracketData.playoffRounds) {
        if (round.matches) {
          const match = round.matches.find((m: Match) => m.id === matchId);
          if (match) {
            targetMatch = match;
            break;
          }
        }
      }
    }

    // Find in standalone matches
    if (!targetMatch && bracketData.matches) {
      targetMatch = bracketData.matches.find((m: Match) => m.id === matchId);
    }

    if (!targetMatch) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    // Validate the advancing team is one of the match participants
    if (
      dto.advancingTeamId !== targetMatch.team1Id &&
      dto.advancingTeamId !== targetMatch.team2Id
    ) {
      throw new BadRequestException(
        'Advancing team must be one of the match participants',
      );
    }

    // Set manual advancement
    targetMatch.manualWinnerId = dto.advancingTeamId;
    targetMatch.winnerId = dto.advancingTeamId;
    targetMatch.isManualOverride = true;
    targetMatch.status = 'COMPLETED';

    // Set loser
    targetMatch.loserId =
      dto.advancingTeamId === targetMatch.team1Id
        ? targetMatch.team2Id
        : targetMatch.team1Id;

    // Propagate winner to next match if exists
    if (targetMatch.nextMatchId) {
      bracketUpdated = this.propagateAdvancement(
        bracketData,
        targetMatch,
        dto.advancingTeamId,
      );
    }

    // Propagate loser to third place match if exists
    if (targetMatch.loserNextMatchId && targetMatch.loserId) {
      this.propagateLoser(
        bracketData,
        targetMatch,
        targetMatch.loserId,
      );
      bracketUpdated = true;
    }

    // Save bracket data (fullBracketData contains the mutation via object reference)
    await this.tournamentsRepository.update(tournamentId, {
      bracketData: fullBracketData,
    });

    return { match: targetMatch, bracketUpdated };
  }

  async updateMatchScore(
    tournamentId: string,
    matchId: string,
    userId: string,
    userRole: string,
    dto: UpdateMatchScoreDto,
    ageGroupId?: string,
  ): Promise<{ match: Match; bracketUpdated: boolean }> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to manage matches for this tournament',
      );
    }

    if (!tournament.bracketData) {
      throw new BadRequestException('No bracket data found for this tournament');
    }

    const fullBracketData = tournament.bracketData as any;
    const bracketData = this.getBracketForAgeGroup(fullBracketData, ageGroupId) || fullBracketData;
    let targetMatch: Match | null = null;

    // Find the match
    if (bracketData.playoffRounds) {
      for (const round of bracketData.playoffRounds) {
        if (round.matches) {
          const match = round.matches.find((m: Match) => m.id === matchId);
          if (match) {
            targetMatch = match;
            break;
          }
        }
      }
    }

    if (!targetMatch && bracketData.matches) {
      targetMatch = bracketData.matches.find((m: Match) => m.id === matchId);
    }

    if (!targetMatch) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    // Update scores
    if (dto.team1Score !== undefined) targetMatch.team1Score = dto.team1Score;
    if (dto.team2Score !== undefined) targetMatch.team2Score = dto.team2Score;
    if (dto.status) targetMatch.status = dto.status as Match['status'];

    let bracketUpdated = false;

    // Handle manual advancement override
    if (dto.advancingTeamId) {
      targetMatch.manualWinnerId = dto.advancingTeamId;
      targetMatch.winnerId = dto.advancingTeamId;
      targetMatch.isManualOverride = true;
      targetMatch.status = 'COMPLETED';
      targetMatch.loserId =
        dto.advancingTeamId === targetMatch.team1Id
          ? targetMatch.team2Id
          : targetMatch.team1Id;

      if (targetMatch.nextMatchId) {
        bracketUpdated = this.propagateAdvancement(
          bracketData,
          targetMatch,
          dto.advancingTeamId,
        );
      }

      // Propagate loser to third place match if exists
      if (targetMatch.loserNextMatchId && targetMatch.loserId) {
        this.propagateLoser(
          bracketData,
          targetMatch,
          targetMatch.loserId,
        );
        bracketUpdated = true;
      }
    } else if (
      targetMatch.team1Score !== undefined &&
      targetMatch.team2Score !== undefined &&
      targetMatch.team1Score !== targetMatch.team2Score &&
      !targetMatch.isManualOverride
    ) {
      // Auto-determine winner from score (only if not manually overridden)
      const winnerId =
        targetMatch.team1Score > targetMatch.team2Score
          ? targetMatch.team1Id
          : targetMatch.team2Id;

      if (winnerId) {
        targetMatch.winnerId = winnerId;
        targetMatch.status = 'COMPLETED';
        targetMatch.loserId =
          winnerId === targetMatch.team1Id
            ? targetMatch.team2Id
            : targetMatch.team1Id;

        if (targetMatch.nextMatchId) {
          bracketUpdated = this.propagateAdvancement(
            bracketData,
            targetMatch,
            winnerId,
          );
        }

        // Propagate loser to third place match if exists
        if (targetMatch.loserNextMatchId && targetMatch.loserId) {
          this.propagateLoser(
            bracketData,
            targetMatch,
            targetMatch.loserId,
          );
          bracketUpdated = true;
        }
      }
    }

    // Save bracket data (fullBracketData contains the mutation via object reference)
    await this.tournamentsRepository.update(tournamentId, {
      bracketData: fullBracketData,
    });

    return { match: targetMatch, bracketUpdated };
  }

  /**
   * BE-07 — Schedule a match: sets scheduledAt and optional courtNumber.
   * Only the tournament organizer (or admin) may call this.
   */
  async scheduleMatch(
    tournamentId: string,
    matchId: string,
    userId: string,
    userRole: string,
    dto: { scheduledAt: string; courtNumber?: number },
    ageGroupId?: string,
  ): Promise<any> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only the tournament organizer can schedule matches',
      );
    }

    const fullBracketData: any = tournament.bracketData || {};
    const bracketData = this.getBracketForAgeGroup(fullBracketData, ageGroupId) || fullBracketData;

    const targetMatch = this.findMatchInBracket(bracketData, matchId);
    if (!targetMatch) {
      throw new NotFoundException(`Match ${matchId} not found in bracket`);
    }

    targetMatch.scheduledAt = new Date(dto.scheduledAt) as any;
    if (dto.courtNumber !== undefined) {
      (targetMatch as any).courtNumber = dto.courtNumber;
    }

    await this.tournamentsRepository.update(tournamentId, {
      bracketData: fullBracketData,
    });

    return targetMatch;
  }

  async generateBracket(
    tournamentId: string,
    userId: string,
    userRole: string,
    ageGroupId?: string,
  ): Promise<any> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
      relations: ['ageGroups'],
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check permission
    if (tournament.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to generate bracket for this tournament',
      );
    }

    // Get approved registrations - filter by ageGroupId if provided
    const regWhere: any = { tournamentId, status: RegistrationStatus.APPROVED };
    if (ageGroupId) {
      regWhere.ageGroupId = ageGroupId;
    }

    const registrations = await this.registrationsRepository.find({
      where: regWhere,
      relations: ['club'],
    });

    if (registrations.length < 2) {
      throw new BadRequestException(
        'At least 2 approved teams are required to generate a bracket',
      );
    }

    // BE-10: Determine bracket type from the age group's persisted format column.
    // The previous cast `(tournament as any).bracketType` was always undefined
    // because Tournament has no such property.
    const ageGroup = ageGroupId
      ? (tournament.ageGroups ?? []).find((ag) => ag.id === ageGroupId)
      : null;
    const bracketType: BracketType =
      ((ageGroup?.format as unknown as BracketType) ??
        BracketType.SINGLE_ELIMINATION);

    const bracketData = this.bracketGeneratorService.generateBracket(
      bracketType,
      registrations.length,
      {
        groupCount: ageGroup?.groupsCount ?? tournament.numberOfGroups,
        thirdPlaceMatch: true,
        seed: tournament.drawSeed || undefined,
        leagueLegs: 2, // default; BE-11: will use ageGroup.leagueLegs once column is added
      },
    );

    // Assign teams to first round matches
    if (bracketData.playoffRounds && bracketData.playoffRounds.length > 0) {
      const firstRound = bracketData.playoffRounds[0];
      const shuffledRegistrations = this.seededShuffle(
        [...registrations],
        bracketData.seed || 'default-seed',
      );

      firstRound.matches.forEach((match: Match, index: number) => {
        const team1Index = index * 2;
        const team2Index = index * 2 + 1;

        if (shuffledRegistrations[team1Index]) {
          match.team1Id = shuffledRegistrations[team1Index].id;
          match.team1Name =
            shuffledRegistrations[team1Index].club?.name ||
            shuffledRegistrations[team1Index].coachName ||
            'Team ' + (team1Index + 1);
        }
        if (shuffledRegistrations[team2Index]) {
          match.team2Id = shuffledRegistrations[team2Index].id;
          match.team2Name =
            shuffledRegistrations[team2Index].club?.name ||
            shuffledRegistrations[team2Index].coachName ||
            'Team ' + (team2Index + 1);
        }
      });
    }

    // Save bracket data - store per age group if ageGroupId is provided
    if (ageGroupId) {
      const existingBracketData = (tournament.bracketData as any) || {};
      // Migrate legacy flat format: if it has playoffRounds at top level, wrap it
      if (existingBracketData.playoffRounds || existingBracketData.type) {
        // Legacy data exists - overwrite with new per-age-group structure
        const newBracketData = { [ageGroupId]: bracketData };
        await this.tournamentsRepository.update(tournamentId, {
          bracketData: newBracketData as any,
        });
      } else {
        existingBracketData[ageGroupId] = bracketData;
        await this.tournamentsRepository.update(tournamentId, {
          bracketData: existingBracketData as any,
        });
      }
    } else {
      await this.tournamentsRepository.update(tournamentId, {
        bracketData: bracketData as any,
      });
    }

    return bracketData;
  }

  /**
   * Propagate match winner to the next match in the bracket
   */
  private propagateAdvancement(
    bracketData: any,
    sourceMatch: Match,
    advancingTeamId: string,
  ): boolean {
    if (!sourceMatch.nextMatchId) return false;

    let nextMatch: Match | null = null;

    // Find next match in playoff rounds
    if (bracketData.playoffRounds) {
      for (const round of bracketData.playoffRounds) {
        if (round.matches) {
          const match = round.matches.find(
            (m: Match) => m.id === sourceMatch.nextMatchId,
          );
          if (match) {
            nextMatch = match;
            break;
          }
        }
      }
    }

    // Find in standalone matches
    if (!nextMatch && bracketData.matches) {
      nextMatch = bracketData.matches.find(
        (m: Match) => m.id === sourceMatch.nextMatchId,
      );
    }

    if (!nextMatch) return false;

    // Place advancing team in the appropriate slot
    if (!nextMatch.team1Id) {
      nextMatch.team1Id = advancingTeamId;
      nextMatch.team1Name = sourceMatch.team1Id === advancingTeamId
        ? sourceMatch.team1Name
        : sourceMatch.team2Name;
    } else if (!nextMatch.team2Id) {
      nextMatch.team2Id = advancingTeamId;
      nextMatch.team2Name = sourceMatch.team1Id === advancingTeamId
        ? sourceMatch.team1Name
        : sourceMatch.team2Name;
    }

    return true;
  }

  /**
   * Propagate the loser of a match to the loserNextMatchId (e.g., third place match)
   */
  private propagateLoser(
    bracketData: any,
    sourceMatch: Match,
    loserTeamId: string,
  ): boolean {
    if (!sourceMatch.loserNextMatchId) return false;

    let loserMatch: Match | null = null;

    // Find loser's next match in playoff rounds
    if (bracketData.playoffRounds) {
      for (const round of bracketData.playoffRounds) {
        if (round.matches) {
          const match = round.matches.find(
            (m: Match) => m.id === sourceMatch.loserNextMatchId,
          );
          if (match) {
            loserMatch = match;
            break;
          }
        }
      }
    }

    // Find in standalone matches
    if (!loserMatch && bracketData.matches) {
      loserMatch = bracketData.matches.find(
        (m: Match) => m.id === sourceMatch.loserNextMatchId,
      );
    }

    if (!loserMatch) return false;

    const loserName =
      sourceMatch.team1Id === loserTeamId
        ? sourceMatch.team1Name
        : sourceMatch.team2Name;

    // Place losing team in the appropriate slot
    if (!loserMatch.team1Id) {
      loserMatch.team1Id = loserTeamId;
      loserMatch.team1Name = loserName;
    } else if (!loserMatch.team2Id) {
      loserMatch.team2Id = loserTeamId;
      loserMatch.team2Name = loserName;
    }

    return true;
  }

  // Seeded shuffle using Fisher-Yates algorithm
  private seededShuffle<T>(array: T[], seed: string): T[] {
    const result = [...array];
    let seedNum = this.hashString(seed);

    for (let i = result.length - 1; i > 0; i--) {
      seedNum = (seedNum * 9301 + 49297) % 233280;
      const j = Math.floor((seedNum / 233280) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * BE-08 — Auto-calculate numberOfMatches for a TournamentAgeGroup after the
   * group draw has been executed.
   *
   * Formula for GROUPS_PLUS_KNOCKOUT:
   *   groupMatches = numGroups × C(teamsPerGroup, 2)          (round-robin within each group)
   *   knockoutMatches = qualifyingTeams – 1                   (single-elim tree; each match eliminates one team)
   *   total = groupMatches + knockoutMatches + 1              (+ 1 for 3rd-place match)
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

      // C(n, 2) = n*(n-1)/2
      const groupMatches = numGroups * ((teamsPerGroup * (teamsPerGroup - 1)) / 2);

      // Default 2 advancing per group (can be overridden in future via ageGroup.advancingPerGroup)
      const advancingPerGroup = 2;
      const qualifyingTeams = numGroups * advancingPerGroup;

      const knockoutMatches = qualifyingTeams - 1;
      const total = groupMatches + knockoutMatches + 1; // +1 third-place match

      await this.ageGroupRepository.update(ageGroupId, {
        numberOfMatches: total,
      });
    } catch {
      // Non-critical — silently skip if calculation fails
    }
  }
}
