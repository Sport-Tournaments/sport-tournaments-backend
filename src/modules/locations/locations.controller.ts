import { Controller, Get, Query, Version } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

interface LocationSuggestion {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  region?: string;
}

interface AutocompleteResponse {
  success: boolean;
  data: LocationSuggestion[];
}

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('autocomplete')
  @Version('1')
  @ApiQuery({ name: 'query', required: false, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Result limit', type: Number })
  @ApiOkResponse({ description: 'Location suggestions' })
  autocomplete(
    @Query('query') query?: string,
    @Query('limit') limit?: string,
  ): AutocompleteResponse {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const results = this.locationsService.autocomplete(query || '', parsedLimit);

    return {
      success: true,
      data: results,
    };
  }
}
