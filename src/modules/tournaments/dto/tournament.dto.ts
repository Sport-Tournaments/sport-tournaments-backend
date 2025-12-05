import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsArray,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  TournamentStatus,
  TournamentLevel,
  Currency,
  AgeCategory,
} from '../../../common/enums';

export class CreateTournamentDto {
  @ApiProperty({ example: 'Summer Youth Cup 2025' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Annual youth football tournament' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: '2025-07-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-07-05' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 'Barcelona, Spain' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location: string;

  @ApiPropertyOptional({ example: 41.3851 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 2.1734 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({ enum: AgeCategory, example: AgeCategory.U14 })
  @IsEnum(AgeCategory)
  ageCategory: AgeCategory;

  @ApiPropertyOptional({ enum: TournamentLevel, default: TournamentLevel.LEVEL_II })
  @IsOptional()
  @IsEnum(TournamentLevel)
  level?: TournamentLevel;

  @ApiPropertyOptional({ example: '4+1', description: 'Game system format' })
  @IsOptional()
  @IsString()
  gameSystem?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  numberOfMatches?: number;

  @ApiProperty({ example: 16 })
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(128)
  maxTeams: number;

  @ApiPropertyOptional({ example: 'https://example.com/regulations.pdf' })
  @IsOptional()
  @IsString()
  regulationsDocument?: string;

  @ApiPropertyOptional({ enum: Currency, default: Currency.EUR })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ example: 250.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  participationFee?: number;

  @ApiPropertyOptional({ example: ['youth', 'competitive', 'international'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: '2025-06-25' })
  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @ApiPropertyOptional({ example: 'organizer@tournament.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+34 123 456 789' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Spain' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateTournamentDto {
  @ApiPropertyOptional({ example: 'Summer Youth Cup 2025' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Annual youth football tournament' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: '2025-07-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-07-05' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Barcelona, Spain' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 41.3851 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 2.1734 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ enum: AgeCategory })
  @IsOptional()
  @IsEnum(AgeCategory)
  ageCategory?: AgeCategory;

  @ApiPropertyOptional({ enum: TournamentLevel })
  @IsOptional()
  @IsEnum(TournamentLevel)
  level?: TournamentLevel;

  @ApiPropertyOptional({ example: '4+1' })
  @IsOptional()
  @IsString()
  gameSystem?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  numberOfMatches?: number;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(128)
  maxTeams?: number;

  @ApiPropertyOptional({ example: 'https://example.com/regulations.pdf' })
  @IsOptional()
  @IsString()
  regulationsDocument?: string;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ example: 250.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  participationFee?: number;

  @ApiPropertyOptional({ example: ['youth', 'competitive'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: '2025-06-25' })
  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @ApiPropertyOptional({ example: 'organizer@tournament.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+34 123 456 789' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Spain' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class TournamentFilterDto {
  @ApiPropertyOptional({ enum: TournamentStatus })
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @ApiPropertyOptional({ enum: AgeCategory })
  @IsOptional()
  @IsEnum(AgeCategory)
  ageCategory?: AgeCategory;

  @ApiPropertyOptional({ enum: TournamentLevel })
  @IsOptional()
  @IsEnum(TournamentLevel)
  level?: TournamentLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gameSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numberOfMatchesMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numberOfMatchesMax?: number;

  @ApiPropertyOptional({ description: 'User latitude for distance calculation' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userLatitude?: number;

  @ApiPropertyOptional({ description: 'User longitude for distance calculation' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userLongitude?: number;

  @ApiPropertyOptional({ description: 'Max distance in km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxDistance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasAvailableSpots?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'startDate', description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}

export class AdminUpdateTournamentDto extends UpdateTournamentDto {
  @ApiPropertyOptional({ enum: TournamentStatus })
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
