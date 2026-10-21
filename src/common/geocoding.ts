/**
 * Address / POI → coordinates. Uses the Google Geocoding API when an API key
 * is given, otherwise OpenStreetMap Nominatim (free, no key; max 1 request
 * per second and an identifying User-Agent, per its usage policy).
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  /** Provider's normalised address, for logging / review. */
  label: string;
  provider: 'google' | 'nominatim';
}

export interface GeocodeOptions {
  /** ISO 3166-1 alpha-2 code to restrict results to, e.g. "ES". */
  countryCode?: string;
  googleApiKey?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GOOGLE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
export const GEOCODER_USER_AGENT =
  'sport-tournaments-geocoder/1.0 (+contact: admin@turnee-sportive.ro)';

export async function geocode(
  query: string,
  options: GeocodeOptions = {},
): Promise<GeocodeResult | null> {
  return options.googleApiKey
    ? geocodeGoogle(query, options.googleApiKey, options.countryCode)
    : geocodeNominatim(query, options.countryCode);
}

async function geocodeGoogle(
  query: string,
  apiKey: string,
  countryCode?: string,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ address: query, key: apiKey });
  if (countryCode) params.set('components', `country:${countryCode}`);
  const res = await fetch(`${GOOGLE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Google geocoding HTTP ${res.status}`);
  const body = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: {
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }[];
  };
  if (body.status === 'ZERO_RESULTS') return null;
  if (body.status !== 'OK') {
    // REQUEST_DENIED / OVER_QUERY_LIMIT etc. are configuration problems.
    throw new Error(
      `Google geocoding ${body.status}${body.error_message ? `: ${body.error_message}` : ''}`,
    );
  }
  const top = body.results?.[0];
  if (!top) return null;
  return {
    latitude: top.geometry.location.lat,
    longitude: top.geometry.location.lng,
    label: top.formatted_address,
    provider: 'google',
  };
}

async function geocodeNominatim(
  query: string,
  countryCode?: string,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
  });
  if (countryCode) params.set('countrycodes', countryCode.toLowerCase());
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': GEOCODER_USER_AGENT,
      'Accept-Language': 'en',
    },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const results = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
  }[];
  const top = results[0];
  if (!top) return null;
  return {
    latitude: parseFloat(top.lat),
    longitude: parseFloat(top.lon),
    label: top.display_name,
    provider: 'nominatim',
  };
}

/** Names Intl doesn't produce, or produces differently, → ISO alpha-2. */
const COUNTRY_ALIASES: Record<string, string> = {
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  uk: 'GB',
  'czech republic': 'CZ',
  turkey: 'TR',
  macedonia: 'MK',
  kosovo: 'XK',
  'the netherlands': 'NL',
  holland: 'NL',
};

/**
 * Reserved / non-country codes Intl still names, e.g. FX "France"
 * (Metropolitan France), which would shadow the real FR.
 */
const NON_COUNTRY_CODES = new Set([
  'EU',
  'EZ',
  'FX',
  'QO',
  'UN',
  'XA',
  'XB',
  'ZZ',
]);

let countryNameIndex: Map<string, string> | undefined;

/** English country name → alpha-2 code, built once from Intl region names. */
function countryNames(): Map<string, string> {
  if (countryNameIndex) return countryNameIndex;
  countryNameIndex = new Map(Object.entries(COUNTRY_ALIASES));
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const A = 65;
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j);
      if (NON_COUNTRY_CODES.has(code)) continue;
      const name = names.of(code);
      // Unknown codes come back unchanged.
      if (name && name !== code) {
        const key = name.toLowerCase();
        // First code wins, so an alias can never shadow the real country.
        if (!countryNameIndex.has(key)) countryNameIndex.set(key, code);
        // Intl writes "Bosnia & Herzegovina"; sources write "and".
        if (key.includes('&')) {
          const andKey = key.replace(/&/g, 'and');
          if (!countryNameIndex.has(andKey)) countryNameIndex.set(andKey, code);
        }
      }
    }
  }
  return countryNameIndex;
}

export function toCountryCode(country?: string | null): string | undefined {
  if (!country) return undefined;
  const c = country.trim();
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  return countryNames().get(c.toLowerCase());
}

/**
 * Queries to try for a tournament, most specific first: venue + address,
 * the address as stored, then simplified forms ("Blanes - Tordera, ES" →
 * "Blanes, ES") and finally just the town.
 */
export function buildGeocodeQueries(t: {
  location?: string | null;
  venueName?: string | null;
  country?: string | null;
}): string[] {
  const location = (t.location ?? '').trim();
  const country = (t.country ?? '').trim();
  const withCountry = (q: string) =>
    country && !q.toLowerCase().includes(country.toLowerCase())
      ? `${q}, ${country}`
      : q;

  const queries: string[] = [];
  if (t.venueName?.trim() && location) {
    queries.push(withCountry(`${t.venueName.trim()}, ${location}`));
  }
  if (location) queries.push(withCountry(location));

  const parts = location
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  // "Blanes - Tordera" / "Schruns-Tschagguns": try the first named place.
  const first = parts[0]?.split(/\s+-\s+|\s*\/\s*/)[0];
  if (first && first !== parts[0]) {
    queries.push(withCountry([first, ...parts.slice(1)].join(', ')));
  }
  // Drop a street line: keep the last two parts (town, country).
  if (parts.length > 2) queries.push(withCountry(parts.slice(-2).join(', ')));

  return [...new Set(queries.filter(Boolean))];
}
