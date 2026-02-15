import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class CreatePlayerDto {
  @ApiProperty({ example: 'Alex', description: 'Player first name' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstname: string;

  @ApiProperty({ example: 'Popescu', description: 'Player last name' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastname: string;

  @ApiProperty({ example: '2010-04-15', description: 'Player birth date' })
  @IsDateString()
  dateOfBirth: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional list of team IDs to associate player with',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds?: string[];
}

export class UpdatePlayerDto {
  @ApiPropertyOptional({ example: 'Alex', description: 'Player first name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstname?: string;

  @ApiPropertyOptional({ example: 'Popescu', description: 'Player last name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastname?: string;

  @ApiPropertyOptional({ example: '2010-04-15', description: 'Player birth date' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replace player teams with the provided team IDs',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds?: string[];
}

export class PlayerFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by team ID' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Search by first/last name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class PlayerSearchDto {
  @ApiPropertyOptional({ description: 'Search text query' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by team ID' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Maximum results', default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
