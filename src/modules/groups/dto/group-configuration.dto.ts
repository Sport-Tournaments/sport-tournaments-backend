import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  Min,
  ValidateNested,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class GroupTeamCount {
  @ApiProperty({
    description: 'Group letter (A, B, C, etc.)',
    example: 'A',
  })
  groupLetter: string;

  @ApiProperty({
    description: 'Number of teams in this group',
    example: 4,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  teamCount: number;
}

export class ConfigureGroupsDto {
  @ApiProperty({
    description: 'Total number of groups',
    example: 4,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  numberOfGroups: number;

  @ApiProperty({
    description: 'Teams per group configuration',
    type: [GroupTeamCount],
    example: [
      { groupLetter: 'A', teamCount: 4 },
      { groupLetter: 'B', teamCount: 4 },
      { groupLetter: 'C', teamCount: 4 },
      { groupLetter: 'D', teamCount: 4 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupTeamCount)
  teamsPerGroup: GroupTeamCount[];
}

export class UpdateGroupDto {
  @ApiProperty({
    description: 'Array of registration IDs to assign to this group',
    type: [String],
    example: ['reg-uuid-1', 'reg-uuid-2', 'reg-uuid-3', 'reg-uuid-4'],
  })
  @IsArray()
  @IsOptional()
  teams?: string[];

  @ApiProperty({
    description: 'Group letter',
    example: 'A',
  })
  @IsOptional()
  groupLetter?: string;
}

export class GroupConfigurationResponseDto {
  @ApiProperty({ description: 'Tournament ID' })
  tournamentId: string;

  @ApiProperty({ description: 'Number of groups configured' })
  numberOfGroups: number;

  @ApiProperty({
    description: 'Teams per group configuration',
    type: [GroupTeamCount],
  })
  teamsPerGroup: GroupTeamCount[];

  @ApiProperty({ description: 'Total teams allocated' })
  totalTeamsAllocated: number;

  @ApiProperty({ description: 'Total registered teams' })
  totalRegisteredTeams: number;

  @ApiProperty({ description: 'Whether configuration is valid' })
  isValid: boolean;

  @ApiProperty({
    description: 'Validation errors if any',
    type: [String],
  })
  errors: string[];

  @ApiProperty({ description: 'Configuration creation timestamp' })
  createdAt: Date;
}
