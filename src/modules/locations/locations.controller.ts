import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LocationsService } from './locations.service';
import { LocationSearchDto, LocationResultDto, ReverseGeocodeDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { Public } from '../../common/decorators';

@ApiTags('Locations')
@Controller('locations')
// These endpoints are public and every call is billed by Google Maps Platform,
// so they get their own (much stricter than global) per-IP rate limit.
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('search')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Search locations by query',
    description:
      'Search for locations using geocoding. Returns coordinates and location details.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching locations',
    type: [LocationResultDto],
  })
  async searchLocations(
    @Query() dto: LocationSearchDto,
  ): Promise<LocationResultDto[]> {
    return this.locationsService.searchLocations(dto);
  }

  @Get('autocomplete')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get location autocomplete suggestions',
    description:
      'Get autocomplete suggestions for location input. Minimum 2 characters required.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of autocomplete suggestions',
    type: [LocationResultDto],
  })
  async getAutocomplete(
    @Query('query') query: string,
    @Query('countryCode') countryCode?: string,
    @Query('limit') limit?: string,
    @Query('sessionToken') sessionToken?: string,
  ): Promise<LocationResultDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.locationsService.getAutocompleteSuggestions(
      query,
      countryCode,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      sessionToken,
    );
  }

  @Get('reverse')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Reverse geocode coordinates',
    description: 'Get location details from latitude/longitude coordinates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Location details',
    type: LocationResultDto,
  })
  async reverseGeocode(
    @Query() dto: ReverseGeocodeDto,
  ): Promise<LocationResultDto | null> {
    return this.locationsService.reverseGeocode(dto);
  }
}
