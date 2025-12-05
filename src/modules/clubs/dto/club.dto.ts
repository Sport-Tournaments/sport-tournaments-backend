import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEmail,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateClubDto {
  @ApiProperty({ example: 'FC Barcelona Youth' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Spain' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country: string;

  @ApiProperty({ example: 'Barcelona' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

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

  @ApiPropertyOptional({ example: 'One of the best youth academies in the world' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ example: 1899 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1800)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({ example: 'https://www.fcbarcelona.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ example: 'contact@fcbarcelona.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+34 123 456 789' })
  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class UpdateClubDto {
  @ApiPropertyOptional({ example: 'FC Barcelona Youth' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Spain' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: 'Barcelona' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

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

  @ApiPropertyOptional({ example: 'One of the best youth academies in the world' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ example: 1899 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1800)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({ example: 'https://www.fcbarcelona.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ example: 'contact@fcbarcelona.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+34 123 456 789' })
  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class ClubFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminUpdateClubDto extends UpdateClubDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;
}
