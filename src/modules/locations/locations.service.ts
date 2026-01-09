import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LocationSearchDto,
  LocationResultDto,
  ReverseGeocodeDto,
} from './dto';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);
  private readonly nominatimBaseUrl = 'https://nominatim.openstreetmap.org';

  constructor(private configService: ConfigService) {}

  /**
   * Search for locations using Nominatim (OpenStreetMap) geocoding service
   * This is a free service, but has rate limiting (1 request per second)
   * For production, consider using Google Places API or similar paid service
   */
  async searchLocations(dto: LocationSearchDto): Promise<LocationResultDto[]> {
    const { query, limit = 5, countryCode } = dto;

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: limit.toString(),
        'accept-language': 'en',
      });

      if (countryCode) {
        params.append('countrycodes', countryCode);
      }

      const response = await fetch(
        `${this.nominatimBaseUrl}/search?${params.toString()}`,
        {
          headers: {
            'User-Agent': 'FootballTournamentPlatform/1.0',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Nominatim API error: ${response.status}`);
        return [];
      }

      const results = await response.json();

      return results.map((result: any) => this.mapNominatimResult(result));
    } catch (error) {
      this.logger.error('Error searching locations:', error);
      return [];
    }
  }

  /**
   * Reverse geocode coordinates to get location details
   */
  async reverseGeocode(dto: ReverseGeocodeDto): Promise<LocationResultDto | null> {
    const { latitude, longitude } = dto;

    try {
      const params = new URLSearchParams({
        lat: latitude.toString(),
        lon: longitude.toString(),
        format: 'json',
        addressdetails: '1',
        'accept-language': 'en',
      });

      const response = await fetch(
        `${this.nominatimBaseUrl}/reverse?${params.toString()}`,
        {
          headers: {
            'User-Agent': 'FootballTournamentPlatform/1.0',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Nominatim reverse geocode error: ${response.status}`);
        return null;
      }

      const result = await response.json();

      if (result.error) {
        return null;
      }

      return this.mapNominatimResult(result);
    } catch (error) {
      this.logger.error('Error reverse geocoding:', error);
      return null;
    }
  }

  /**
   * Get autocomplete suggestions for location input
   * This method adds debouncing on the client side
   */
  async getAutocompleteSuggestions(
    query: string,
    countryCode?: string,
  ): Promise<LocationResultDto[]> {
    if (!query || query.length < 2) {
      return [];
    }

    return this.searchLocations({
      query,
      limit: 10,
      countryCode,
    });
  }

  private mapNominatimResult(result: any): LocationResultDto {
    const address = result.address || {};

    return {
      displayName: result.display_name,
      city:
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        '',
      region: address.state || address.region || '',
      country: address.country || '',
      countryCode: (address.country_code || '').toUpperCase(),
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      postalCode: address.postcode || undefined,
      address: this.buildAddressString(address),
    };
  }

  private buildAddressString(address: any): string | undefined {
    const parts = [
      address.house_number,
      address.road,
      address.suburb,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : undefined;
  }
}
