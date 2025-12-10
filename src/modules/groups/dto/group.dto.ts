import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  IsUUID,
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
