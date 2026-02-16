import { IsUUID, IsNumber, IsArray, ValidateNested, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignTeamToPotDto {
  @IsUUID()
  registrationId: string;

  @IsNumber()
  @Min(1)
  @Max(4)
  potNumber: number;
}

export class AssignPotsBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignTeamToPotDto)
  assignments: AssignTeamToPotDto[];
}

export class ExecutePotDrawDto {
  @IsNumber()
  @Min(1)
  @Max(32)
  numberOfGroups: number;

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
