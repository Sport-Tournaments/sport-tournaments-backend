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
  IsUUID,
  ValidateNested,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  TournamentStatus,
  TournamentLevel,
  Currency,
  AgeCategory,
} from '../../../common/enums';
import { BracketType } from '../../groups/services/bracket-generator.service';
import { PaginationDto } from '../../../common/dto';

// Nested DTOs for complex types
export class VisibilitySettingsDto {
  @ApiPropertyOptional({ description: 'Partner team IDs that can see this tournament' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  partnerTeams?: string[];

  @ApiPropertyOptional({ description: 'Past participant IDs that can see this tournament' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  pastParticipants?: string[];

  @ApiPropertyOptional({ description: 'Manual list of emails to notify' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  manualEmailList?: string[];

  @ApiPropertyOptional({ description: 'Whether to list on public search', default: false })
  @IsOptional()
  @IsBoolean()
  isPublicListing?: boolean;
}

export class CreateAgeGroupDto {
  @ApiProperty({ example: 2012 })
  @IsNumber()
  @Min(1990)
  @Max(2025)
  birthYear: number;

  @ApiPropertyOptional({ example: 'U12' })
  @IsOptional()
  @IsString()
  displayLabel?: string;

  @ApiPropertyOptional({ example: '5+1' })
  @IsOptional()
  @IsString()
  gameSystem?: string;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  teamCount?: number;

  @ApiPropertyOptional({ example: 4, description: 'Minimum number of teams required for the age group to be played' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  minTeams?: number;

  @ApiPropertyOptional({ example: '2025-07-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-07-02' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Location ID for this age group' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ example: 250.00 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  participationFee?: number;

  @ApiPropertyOptional({ example: 4, description: 'Number of groups for this age category' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  groupsCount?: number;

  @ApiPropertyOptional({ example: 4, description: 'Teams per group' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  teamsPerGroup?: number;
}

export class CreateLocationDto {
  @ApiProperty({ example: 'Camp Nou Training Grounds' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  venueName: string;

  @ApiPropertyOptional({ example: 41.3809 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 2.1228 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 'Carrer de Aristides Maillol, 12' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Barcelona' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Spain' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  fieldCount?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ example: 'NATURAL_GRASS' })
  @IsOptional()
  @IsString()
  fieldType?: string;

  @ApiPropertyOptional({ example: '68x105m' })
  @IsOptional()
  @IsString()
  fieldDimensions?: string;

  @ApiPropertyOptional({ 
    example: { parking: true, changing_rooms: true, cafe: true, medical: false },
    description: 'Available facilities' 
  })
  @IsOptional()
  @IsObject()
  facilities?: Record<string, boolean>;

  @ApiPropertyOptional({ example: 'Juan Garcia' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: '+34 123 456 789' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'venue@example.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

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

  // New privacy and visibility fields
  @ApiPropertyOptional({ description: 'Whether tournament is private (invite-only)', default: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ type: VisibilitySettingsDto, description: 'Visibility settings for private tournaments' })
  @IsOptional()
  @ValidateNested()
  @Type(() => VisibilitySettingsDto)
  visibilitySettings?: VisibilitySettingsDto;

  // Bracket configuration
  @ApiPropertyOptional({ enum: BracketType, description: 'Type of bracket/format' })
  @IsOptional()
  @IsEnum(BracketType)
  bracketType?: BracketType;

  @ApiPropertyOptional({ example: 4, description: 'Number of groups' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  groupCount?: number;

  @ApiPropertyOptional({ example: 4, description: 'Teams per group' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  teamsPerGroup?: number;

  @ApiPropertyOptional({ example: true, description: 'Include third place match' })
  @IsOptional()
  @IsBoolean()
  thirdPlaceMatch?: boolean;

  // Regulations
  @ApiPropertyOptional({ enum: ['UPLOADED', 'GENERATED'], description: 'Type of regulations' })
  @IsOptional()
  @IsString()
  regulationsType?: 'UPLOADED' | 'GENERATED';

  @ApiPropertyOptional({ description: 'Generated regulations form data' })
  @IsOptional()
  @IsObject()
  regulationsData?: Record<string, unknown>;

  // Marketing
  @ApiPropertyOptional({ example: 'https://example.com/brochure.pdf' })
  @IsOptional()
  @IsString()
  brochureUrl?: string;

  @ApiPropertyOptional({ 
    example: { facebook: 'https://...', instagram: 'https://...' },
    description: 'Social media asset URLs' 
  })
  @IsOptional()
  @IsObject()
  socialMediaAssets?: Record<string, string>;

  @ApiPropertyOptional({ example: 'summer-youth-cup-2025', description: 'URL-friendly slug' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  urlSlug?: string;

  // Multiple age groups
  @ApiPropertyOptional({ type: [CreateAgeGroupDto], description: 'Age groups for the tournament' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAgeGroupDto)
  ageGroups?: CreateAgeGroupDto[];

  // Multiple locations
  @ApiPropertyOptional({ type: [CreateLocationDto], description: 'Locations/venues for the tournament' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLocationDto)
  locations?: CreateLocationDto[];
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

  // New privacy and visibility fields
  @ApiPropertyOptional({ description: 'Whether tournament is private (invite-only)' })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ type: VisibilitySettingsDto, description: 'Visibility settings for private tournaments' })
  @IsOptional()
  @ValidateNested()
  @Type(() => VisibilitySettingsDto)
  visibilitySettings?: VisibilitySettingsDto;

  // Bracket configuration
  @ApiPropertyOptional({ enum: BracketType, description: 'Type of bracket/format' })
  @IsOptional()
  @IsEnum(BracketType)
  bracketType?: BracketType;

  @ApiPropertyOptional({ example: 4, description: 'Number of groups' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  groupCount?: number;

  @ApiPropertyOptional({ example: 4, description: 'Teams per group' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  teamsPerGroup?: number;

  @ApiPropertyOptional({ example: true, description: 'Include third place match' })
  @IsOptional()
  @IsBoolean()
  thirdPlaceMatch?: boolean;

  // Regulations
  @ApiPropertyOptional({ enum: ['UPLOADED', 'GENERATED'], description: 'Type of regulations' })
  @IsOptional()
  @IsString()
  regulationsType?: 'UPLOADED' | 'GENERATED';

  @ApiPropertyOptional({ description: 'Generated regulations form data' })
  @IsOptional()
  @IsObject()
  regulationsData?: Record<string, unknown>;

  // Marketing
  @ApiPropertyOptional({ example: 'https://example.com/brochure.pdf' })
  @IsOptional()
  @IsString()
  brochureUrl?: string;

  @ApiPropertyOptional({ 
    example: { facebook: 'https://...', instagram: 'https://...' },
    description: 'Social media asset URLs' 
  })
  @IsOptional()
  @IsObject()
  socialMediaAssets?: Record<string, string>;

  @ApiPropertyOptional({ example: 'summer-youth-cup-2025', description: 'URL-friendly slug' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  urlSlug?: string;
}

export class TournamentFilterDto extends PaginationDto {
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

  @ApiPropertyOptional({ description: 'Max distance in km (default: 50 when user location provided)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxDistance?: number;

  @ApiPropertyOptional({ description: 'Sort results by distance from user location', default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  sortByDistance?: boolean;

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

  @ApiPropertyOptional({ description: 'Filter for private/public tournaments' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPrivate?: boolean;

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

// Invitation code DTOs
export class ValidateInvitationCodeDto {
  @ApiProperty({ example: 'ABC123XY', description: 'Invitation code to validate' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code: string;
}

export class InvitationCodeResponseDto {
  @ApiProperty({ example: 'ABC123XY' })
  invitationCode: string;

  @ApiProperty({ example: '2025-12-31T23:59:59.000Z' })
  expiresAt: Date | null;

  @ApiProperty({ example: 'uuid-here' })
  tournamentId: string;

  @ApiProperty({ example: 'Summer Youth Cup 2025' })
  tournamentName: string;
}

export class RegenerateInvitationCodeDto {
  @ApiPropertyOptional({ 
    example: 30, 
    description: 'Number of days until the code expires. If not provided, code will not expire.' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
