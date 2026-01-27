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
  private readonly googleMapsBaseUrl = 'https://maps.googleapis.com/maps/api';

  constructor(private configService: ConfigService) {}

  /**
   * Search for locations using Google Geocoding API
   */
  async searchLocations(dto: LocationSearchDto): Promise<LocationResultDto[]> {
    const { query, limit = 5, countryCode } = dto;

    const apiKey = this.getGoogleMapsApiKey();
    if (!apiKey) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        address: query,
        key: apiKey,
        language: 'en',
      });

      if (countryCode) {
        params.append('components', `country:${countryCode.toLowerCase()}`);
      }

      const response = await fetch(
        `${this.googleMapsBaseUrl}/geocode/json?${params.toString()}`,
      );

      if (!response.ok) {
        this.logger.warn(`Google Geocoding API error: ${response.status}`);
        return [];
      }

      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results : [];

      return results.slice(0, limit).map((result: any) => this.mapGoogleGeocodeResult(result));
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

    const apiKey = this.getGoogleMapsApiKey();
    if (!apiKey) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        latlng: `${latitude},${longitude}`,
        key: apiKey,
        language: 'en',
      });

      const response = await fetch(
        `${this.googleMapsBaseUrl}/geocode/json?${params.toString()}`,
      );

      if (!response.ok) {
        this.logger.warn(`Google reverse geocode error: ${response.status}`);
        return null;
      }

      const payload = await response.json();
      const result = Array.isArray(payload.results) ? payload.results[0] : null;

      if (!result) {
        return null;
      }

      return this.mapGoogleGeocodeResult(result);
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

    const apiKey = this.getGoogleMapsApiKey();
    if (!apiKey) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        input: query,
        key: apiKey,
        language: 'en',
        types: 'geocode',
      });

      if (countryCode) {
        params.append('components', `country:${countryCode.toLowerCase()}`);
      }

      const response = await fetch(
        `${this.googleMapsBaseUrl}/place/autocomplete/json?${params.toString()}`,
      );

      if (!response.ok) {
        this.logger.warn(`Google Places Autocomplete error: ${response.status}`);
        return [];
      }

      const payload = await response.json();
      const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];

      const detailsResults = await Promise.all(
        predictions.slice(0, 10).map(async (prediction: any) => {
          if (!prediction?.place_id) {
            return null;
          }

          const detailsParams = new URLSearchParams({
            place_id: prediction.place_id,
            key: apiKey,
            language: 'en',
            fields: 'place_id,formatted_address,name,address_component,geometry',
          });

          try {
            const detailsResponse = await fetch(
              `${this.googleMapsBaseUrl}/place/details/json?${detailsParams.toString()}`,
            );

            if (!detailsResponse.ok) {
              this.logger.warn(`Google Places Details error: ${detailsResponse.status}`);
              return null;
            }

            const detailsPayload = await detailsResponse.json();
            return detailsPayload.result || null;
          } catch (error) {
            this.logger.warn('Error fetching place details:', error);
            return null;
          }
        }),
      );

      return detailsResults
        .filter((result): result is any => !!result)
        .map((result) => this.mapGooglePlaceResult(result));
    } catch (error) {
      this.logger.error('Error fetching autocomplete suggestions:', error);
      return [];
    }
  }

  private getGoogleMapsApiKey(): string | null {
    const apiKey = this.configService.get<string>('googleMaps.apiKey');
    if (!apiKey) {
      this.logger.warn('GOOGLE_MAPS_API_KEY is not configured');
      return null;
    }
    return apiKey;
  }

  private mapGoogleGeocodeResult(result: any): LocationResultDto {
    const addressData = this.parseGoogleAddressComponents(result?.address_components || []);

    return {
      displayName: result.formatted_address || result.name || '',
      formattedAddress: result.formatted_address || result.name || '',
      city: addressData.city,
      region: addressData.region,
      country: addressData.country,
      countryCode: addressData.countryCode,
      latitude: result.geometry?.location?.lat,
      longitude: result.geometry?.location?.lng,
      postalCode: addressData.postalCode,
      address: addressData.address,
      placeId: result.place_id,
    };
  }

  private mapGooglePlaceResult(result: any): LocationResultDto {
    const addressData = this.parseGoogleAddressComponents(result?.address_components || []);

    return {
      displayName: result.formatted_address || result.name || '',
      formattedAddress: result.formatted_address || result.name || '',
      city: addressData.city,
      region: addressData.region,
      country: addressData.country,
      countryCode: addressData.countryCode,
      latitude: result.geometry?.location?.lat,
      longitude: result.geometry?.location?.lng,
      postalCode: addressData.postalCode,
      address: addressData.address,
      placeId: result.place_id,
    };
  }

  private parseGoogleAddressComponents(components: any[]): {
    city: string;
    region?: string;
    country: string;
    countryCode: string;
    postalCode?: string;
    address?: string;
  } {
    const getComponent = (type: string) =>
      components.find((component) => component.types?.includes(type));

    const streetNumber = getComponent('street_number')?.long_name;
    const route = getComponent('route')?.long_name;
    const locality =
      getComponent('locality')?.long_name ||
      getComponent('postal_town')?.long_name ||
      getComponent('administrative_area_level_3')?.long_name ||
      getComponent('administrative_area_level_2')?.long_name ||
      '';
    const region =
      getComponent('administrative_area_level_1')?.long_name ||
      getComponent('administrative_area_level_2')?.long_name ||
      undefined;
    const country = getComponent('country')?.long_name || '';
    const countryCode = (getComponent('country')?.short_name || '').toUpperCase();
    const postalCode = getComponent('postal_code')?.long_name;

    const address = [streetNumber, route].filter(Boolean).join(' ') || undefined;

    return {
      city: locality,
      region,
      country,
      countryCode,
      postalCode,
      address,
    };
  }
}
