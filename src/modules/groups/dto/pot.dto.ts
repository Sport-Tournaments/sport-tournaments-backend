import {
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignTeamToPotDto {
  @IsUUID()
  registrationId: string;

  @IsNumber()
  @Min(1)
  @Max(32)
  potNumber: number;
}

export class AssignPotsBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignTeamToPotDto)
  assignments: AssignTeamToPotDto[];
}

export class ExecutePotDrawDto {
  @ApiPropertyOptional({
    example: 12,
    description:
      'Number of pots to use when running the pot draw (required when numberOfGroups is not provided).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(32)
  numberOfPots?: number;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Backward-compatible alias for numberOfPots. Kept for existing clients.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(32)
  numberOfGroups?: number;

  @IsOptional()
  @IsUUID()
  ageGroupId?: string;
}

export class PotAssignmentResponseDto {
  registrationId: string;
  teamName: string;
  potNumber: number;
}

export class PotResponseDto {
  potNumber: number;
  teams: PotAssignmentResponseDto[];
  count: number;
}
