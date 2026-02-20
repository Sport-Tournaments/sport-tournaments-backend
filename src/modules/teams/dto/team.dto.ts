import {
  IsString,
  MinLength,
  MaxLength,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class CreateTeamDto {
  @ApiProperty({ description: 'Club ID for the team' })
  @IsUUID()
  clubId: string;

  @ApiProperty({ example: 'U17 A', description: 'Team name' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'U17', description: 'Team age category' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  ageCategory: string;

  @ApiProperty({ example: 2009, description: 'Team birth year' })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  birthyear: number;

  @ApiProperty({ example: 'John Smith', description: 'Team coach name' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  coach: string;

  @ApiPropertyOptional({ example: '+1 234 567 8900', description: 'Coach phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  coachPhone?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional player IDs to assign to the team',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  playerIds?: string[];
}

export class UpdateTeamDto {
  @ApiPropertyOptional({ description: 'Club ID for the team' })
  @IsOptional()
  @IsUUID()
  clubId?: string;

  @ApiPropertyOptional({ example: 'U17 A', description: 'Team name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'U17', description: 'Team age category' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  ageCategory?: string;

  @ApiPropertyOptional({ example: 2009, description: 'Team birth year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  birthyear?: number;

  @ApiPropertyOptional({ example: 'John Smith', description: 'Team coach name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  coach?: string;

  @ApiPropertyOptional({ example: '+1 234 567 8900', description: 'Coach phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  coachPhone?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replace team players with the provided list of player IDs',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  playerIds?: string[];
}

export class TeamFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by club ID' })
  @IsOptional()
  @IsUUID()
  clubId?: string;

  @ApiPropertyOptional({ description: 'Search by team name, coach or age category' })
  @IsOptional()
  @IsString()
  search?: string;
}
