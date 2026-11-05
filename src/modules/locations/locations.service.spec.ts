import { ConfigService } from '@nestjs/config';
import { LocationsService } from './locations.service';

describe('LocationsService.getAutocompleteSuggestions', () => {
  const fetchMock = jest.fn();
  let service: LocationsService;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new LocationsService({
      get: () => 'test-key',
    } as unknown as ConfigService);
  });

  const okJson = (body: unknown) => ({ ok: true, json: () => body });

  it('does not restrict predictions to geocode results, so venues (POIs) are found', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ predictions: [] }));

    await service.getAutocompleteSuggestions('Arena Nationala');

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toContain('/place/autocomplete/json');
    expect(url.searchParams.has('types')).toBe(false);
  });

  it('maps a point of interest with its venue name', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ predictions: [{ place_id: 'p1' }] }))
      .mockResolvedValueOnce(
        okJson({
          result: {
            place_id: 'p1',
            name: 'Arena Nationala',
            formatted_address: 'Bulevardul Basarabia 37-39, Bucuresti, Romania',
            types: ['stadium', 'point_of_interest', 'establishment'],
            geometry: { location: { lat: 44.437, lng: 26.152 } },
            address_components: [
              { long_name: 'Bucuresti', types: ['locality'] },
              { long_name: 'Romania', short_name: 'RO', types: ['country'] },
            ],
          },
        }),
      );

    const [result] = await service.getAutocompleteSuggestions('Arena');

    expect(result).toMatchObject({
      placeId: 'p1',
      venueName: 'Arena Nationala',
      isPointOfInterest: true,
      formattedAddress:
        'Arena Nationala, Bulevardul Basarabia 37-39, Bucuresti, Romania',
      latitude: 44.437,
      longitude: 26.152,
      countryCode: 'RO',
    });
  });

  it('keeps plain addresses without a venue name', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ predictions: [{ place_id: 'p2' }] }))
      .mockResolvedValueOnce(
        okJson({
          result: {
            place_id: 'p2',
            name: 'Strada Lunga 1',
            formatted_address: 'Strada Lunga 1, Brasov, Romania',
            types: ['street_address'],
            geometry: { location: { lat: 45.6, lng: 25.6 } },
            address_components: [],
          },
        }),
      );

    const [result] = await service.getAutocompleteSuggestions('Strada Lunga');

    expect(result.venueName).toBeUndefined();
    expect(result.isPointOfInterest).toBe(false);
    expect(result.formattedAddress).toBe('Strada Lunga 1, Brasov, Romania');
  });

  it('caps Place Details calls at the requested limit', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        predictions: Array.from({ length: 8 }, (_, i) => ({
          place_id: `p${i}`,
        })),
      }),
    );
    fetchMock.mockResolvedValue(okJson({ result: null }));

    await service.getAutocompleteSuggestions('Stadion', undefined, 3);

    // 1 autocomplete + 3 details
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it('ignores queries shorter than 3 characters without calling Google', async () => {
    await expect(service.getAutocompleteSuggestions('ab')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a repeated identical query from cache (no second Google call)', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ predictions: [{ place_id: 'p9' }] }))
      .mockResolvedValueOnce(
        okJson({
          result: {
            place_id: 'p9',
            name: 'Cache Arena',
            formatted_address: 'Cache Arena, Brasov, Romania',
            types: ['stadium'],
            geometry: { location: { lat: 45.6, lng: 25.6 } },
            address_components: [],
          },
        }),
      );

    const first = await service.getAutocompleteSuggestions('Cache Arena');
    const second = await service.getAutocompleteSuggestions('cache arena ');

    expect(second).toEqual(first);
    // 1 autocomplete + 1 details, and nothing for the second call
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('LocationsService predictions and place details', () => {
  const fetchMock = jest.fn();
  let service: LocationsService;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new LocationsService({
      get: () => 'test-key',
    } as unknown as ConfigService);
  });

  const okJson = (body: unknown) => ({ ok: true, json: () => body });

  it('returns predictions without any Place Details call when details are off', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        predictions: [
          {
            place_id: 'p1',
            description: 'Arena Nationala, Bucuresti, Romania',
            structured_formatting: {
              main_text: 'Arena Nationala',
              secondary_text: 'Bucuresti, Romania',
            },
            types: ['stadium', 'establishment'],
          },
          { place_id: 'p2', description: 'Arad, Romania', types: ['locality'] },
        ],
      }),
    );

    const results = await service.getAutocompleteSuggestions(
      'Ara',
      undefined,
      5,
      'session-1',
      false,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      {
        placeId: 'p1',
        formattedAddress: 'Arena Nationala, Bucuresti, Romania',
        mainText: 'Arena Nationala',
        secondaryText: 'Bucuresti, Romania',
        venueName: 'Arena Nationala',
        isPointOfInterest: true,
      },
      {
        placeId: 'p2',
        formattedAddress: 'Arad, Romania',
        mainText: undefined,
        secondaryText: undefined,
        venueName: undefined,
        isPointOfInterest: false,
      },
    ]);
  });

  it('fetches details for the picked place with the session token, then caches them', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        result: {
          place_id: 'p1',
          formatted_address: 'Arad, Romania',
          types: ['locality'],
          geometry: { location: { lat: 46.18, lng: 21.31 } },
          address_components: [
            { long_name: 'Arad', types: ['locality'] },
            { long_name: 'Romania', short_name: 'RO', types: ['country'] },
          ],
        },
      }),
    );

    const first = await service.getPlaceDetails('p1', 'session-1');
    const second = await service.getPlaceDetails('p1', 'session-2');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toContain('/place/details/json');
    expect(url.searchParams.get('place_id')).toBe('p1');
    expect(url.searchParams.get('sessiontoken')).toBe('session-1');
    expect(first).toMatchObject({
      city: 'Arad',
      latitude: 46.18,
      countryCode: 'RO',
    });
    expect(second).toBe(first);
  });
});
