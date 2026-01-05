import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import {
  LocationSearchDto,
  LocationResultDto,
  ReverseGeocodeDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { Public } from '../../common/decorators';

@ApiTags('Locations')
@Controller('locations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Search locations by query',
    description: 'Search for locations using geocoding. Returns coordinates and location details.',
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
  @ApiOperation({
    summary: 'Get location autocomplete suggestions',
    description: 'Get autocomplete suggestions for location input. Minimum 2 characters required.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of autocomplete suggestions',
    type: [LocationResultDto],
  })
  async getAutocomplete(
    @Query('query') query: string,
    @Query('countryCode') countryCode?: string,
  ): Promise<LocationResultDto[]> {
    return this.locationsService.getAutocompleteSuggestions(query, countryCode);
  }

  @Get('reverse')
  @Public()
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
