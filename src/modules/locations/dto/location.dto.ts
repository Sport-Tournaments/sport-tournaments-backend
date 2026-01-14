import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class LocationSearchDto {
  @ApiProperty({ example: 'Barcelona', description: 'Search query for location' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ example: 5, description: 'Maximum number of results' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({ example: 'es', description: 'Country code to filter results' })
  @IsOptional()
  @IsString()
  countryCode?: string;
}

export class LocationResultDto {
  @ApiProperty({ example: 'Barcelona, Catalonia, Spain' })
  displayName: string;

  @ApiProperty({ example: 'Barcelona, Catalonia, Spain' })
  formattedAddress: string;

  @ApiProperty({ example: 'Barcelona' })
  city: string;

  @ApiProperty({ example: 'Catalonia' })
  region?: string;

  @ApiProperty({ example: 'Spain' })
  country: string;

  @ApiProperty({ example: 'ES' })
  countryCode: string;

  @ApiProperty({ example: 41.3851 })
  latitude: number;

  @ApiProperty({ example: 2.1734 })
  longitude: number;

  @ApiPropertyOptional({ example: '08001' })
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Carrer de Balmes, 100' })
  address?: string;
}

export class ReverseGeocodeDto {
  @ApiProperty({ example: 41.3851, description: 'Latitude coordinate' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 2.1734, description: 'Longitude coordinate' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}
