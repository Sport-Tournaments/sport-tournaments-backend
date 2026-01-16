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
import { Registration } from '../registrations/entities/registration.entity';
import { ExecuteDrawDto, UpdateBracketDto, CreateGroupDto, ConfigureGroupsDto, UpdateGroupDto, GroupConfigurationResponseDto } from './dto';
import {
  TournamentStatus,
  RegistrationStatus,
  UserRole,
} from '../../common/enums';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupsRepository: Repository<Group>,
    @InjectRepository(Tournament)
    private tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Registration)
    private registrationsRepository: Repository<Registration>,
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
}
