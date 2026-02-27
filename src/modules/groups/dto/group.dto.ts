import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  IsUUID,
  IsISO8601,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ExecuteDrawDto {
  @ApiPropertyOptional({
    example: 4,
    description: 'Number of groups to create',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  numberOfGroups?: number;

  @ApiPropertyOptional({ description: 'Seed for reproducible random draw' })
  @IsOptional()
  @IsString()
  seed?: string;
}

export class ManualGroupAssignmentDto {
  @ApiProperty({ description: 'Registration ID' })
  @IsUUID()
  registrationId: string;

  @ApiProperty({ example: 'A', description: 'Group letter to assign' })
  @IsString()
  groupLetter: string;
}

export class UpdateBracketDto {
  @ApiProperty({ type: [ManualGroupAssignmentDto] })
  @IsArray()
  assignments: ManualGroupAssignmentDto[];
}

export class CreateGroupDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  groupLetter: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of registration IDs',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teams?: string[];

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  groupOrder?: number;
}

export class UpdateMatchAdvancementDto {
  @ApiProperty({ description: 'ID of the team (registration) that advances/wins' })
  @IsUUID()
  advancingTeamId: string;
}

export class UpdateMatchScoreDto {
  @ApiPropertyOptional({ description: 'Score of team 1' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  team1Score?: number;

  @ApiPropertyOptional({ description: 'Score of team 2' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  team2Score?: number;

  @ApiPropertyOptional({ description: 'ID of the advancing/winning team (manual override)' })
  @IsOptional()
  @IsString()
  advancingTeamId?: string;

  @ApiPropertyOptional({ description: 'Match status' })
  @IsOptional()
  @IsString()
  status?: string;
}

/** BE-07 — Schedule a match (set date/time and optional court number) */
export class ScheduleMatchDto {
  @ApiProperty({
    example: '2026-07-15T09:00:00Z',
    description: 'ISO 8601 datetime when the match is scheduled to start',
  })
  @IsISO8601()
  scheduledAt: string;

  @ApiPropertyOptional({ example: 3, description: 'Court / field number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  courtNumber?: number;
}
