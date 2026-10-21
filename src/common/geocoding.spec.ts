import { buildGeocodeQueries, geocode, toCountryCode } from './geocoding';

describe('geocoding helpers', () => {
  it('maps every country name the importers use to an ISO code', () => {
    const names = [
      'Albania',
      'Andorra',
      'Argentina',
      'Armenia',
      'Austria',
      'Belgium',
      'Bosnia and Herzegovina',
      'Bulgaria',
      'Costa Rica',
      'Croatia',
      'Cyprus',
      'Czech Republic',
      'Denmark',
      'Dominican Republic',
      'Egypt',
      'England',
      'Estonia',
      'Finland',
      'France',
      'Georgia',
      'Germany',
      'Greece',
      'Hungary',
      'Ireland',
      'Italy',
      'Kosovo',
      'Latvia',
      'Macedonia',
      'Malta',
      'Mexico',
      'Moldova',
      'Morocco',
      'Netherlands',
      'North Macedonia',
      'Poland',
      'Portugal',
      'Romania',
      'Scotland',
      'Serbia',
      'Slovakia',
      'Slovenia',
      'Spain',
      'Switzerland',
      'Turkey',
      'Ukraine',
      'United Arab Emirates',
      'United Kingdom',
      'Uruguay',
    ];
    expect(names.filter((n) => !toCountryCode(n))).toEqual([]);
    expect(toCountryCode('Spain')).toBe('ES');
    // Intl also names the reserved code FX "France"; it must not win.
    expect(toCountryCode('France')).toBe('FR');
    expect(toCountryCode('es')).toBe('ES');
    expect(toCountryCode('England')).toBe('GB');
    expect(toCountryCode('Atlantis')).toBeUndefined();
  });

  it('builds queries from most to least specific', () => {
    expect(
      buildGeocodeQueries({
        location: 'Calle Mayor 3, Barcelona, Spain',
        venueName: 'Camp Nou',
        country: 'Spain',
      }),
    ).toEqual([
      'Camp Nou, Calle Mayor 3, Barcelona, Spain',
      'Calle Mayor 3, Barcelona, Spain',
      'Barcelona, Spain',
    ]);
    expect(
      buildGeocodeQueries({ location: 'Blanes - Tordera', country: 'Spain' }),
    ).toEqual(['Blanes - Tordera, Spain', 'Blanes, Spain']);
    expect(buildGeocodeQueries({ location: '' })).toEqual([]);
  });

  describe('geocode', () => {
    const fetchMock = jest.fn();
    beforeEach(() => {
      fetchMock.mockReset();
      global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('uses Nominatim without an API key', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => [
          { lat: '41.67', lon: '2.79', display_name: 'Blanes' },
        ],
      });
      const r = await geocode('Blanes, Spain', { countryCode: 'ES' });
      expect(r).toEqual({
        latitude: 41.67,
        longitude: 2.79,
        label: 'Blanes',
        provider: 'nominatim',
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('nominatim.openstreetmap.org');
      expect(url).toContain('countrycodes=es');
      expect(init.headers['User-Agent']).toMatch(/sport-tournaments/);
    });

    it('uses Google with an API key and surfaces config errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            {
              formatted_address: 'Blanes, Spain',
              geometry: { location: { lat: 41.6, lng: 2.7 } },
            },
          ],
        }),
      });
      const r = await geocode('Blanes', {
        googleApiKey: 'k',
        countryCode: 'ES',
      });
      expect(r?.provider).toBe('google');
      expect(fetchMock.mock.calls[0][0]).toContain('components=country%3AES');

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ZERO_RESULTS' }),
      });
      await expect(
        geocode('nowhere', { googleApiKey: 'k' }),
      ).resolves.toBeNull();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'REQUEST_DENIED',
          error_message: 'API key invalid',
        }),
      });
      await expect(geocode('x', { googleApiKey: 'bad' })).rejects.toThrow(
        'REQUEST_DENIED',
      );
    });
  });
});
