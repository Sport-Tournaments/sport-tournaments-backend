/**
 * Realistic location data for seeding
 */

export interface CityLocation {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

export const ROMANIAN_CITIES: CityLocation[] = [
  { name: 'București', country: 'Romania', lat: 44.4268, lng: 26.1025 },
  { name: 'Cluj-Napoca', country: 'Romania', lat: 46.7712, lng: 23.6236 },
  { name: 'Timișoara', country: 'Romania', lat: 45.7594, lng: 21.2272 },
  { name: 'Iași', country: 'Romania', lat: 47.1585, lng: 27.6014 },
  { name: 'Constanța', country: 'Romania', lat: 44.1598, lng: 28.6348 },
  { name: 'Craiova', country: 'Romania', lat: 44.3302, lng: 23.7949 },
  { name: 'Brașov', country: 'Romania', lat: 45.6427, lng: 25.5887 },
  { name: 'Galați', country: 'Romania', lat: 45.4353, lng: 28.0080 },
  { name: 'Ploiești', country: 'Romania', lat: 44.9364, lng: 26.0136 },
  { name: 'Oradea', country: 'Romania', lat: 47.0722, lng: 21.9217 },
  { name: 'Brăila', country: 'Romania', lat: 45.2692, lng: 27.9575 },
  { name: 'Arad', country: 'Romania', lat: 46.1866, lng: 21.3123 },
  { name: 'Pitești', country: 'Romania', lat: 44.8565, lng: 24.8692 },
  { name: 'Sibiu', country: 'Romania', lat: 45.7983, lng: 24.1256 },
  { name: 'Bacău', country: 'Romania', lat: 46.5670, lng: 26.9146 },
];

export const EUROPEAN_CITIES: CityLocation[] = [
  // Germany
  { name: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050 },
  { name: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.5820 },
  { name: 'Frankfurt', country: 'Germany', lat: 50.1109, lng: 8.6821 },
  { name: 'Hamburg', country: 'Germany', lat: 53.5511, lng: 9.9937 },
  { name: 'Cologne', country: 'Germany', lat: 50.9375, lng: 6.9603 },
  // France
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'Lyon', country: 'France', lat: 45.7640, lng: 4.8357 },
  { name: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698 },
  { name: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442 },
  { name: 'Nice', country: 'France', lat: 43.7102, lng: 7.2620 },
  // Spain
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
  { name: 'Barcelona', country: 'Spain', lat: 41.3851, lng: 2.1734 },
  { name: 'Valencia', country: 'Spain', lat: 39.4699, lng: -0.3763 },
  { name: 'Seville', country: 'Spain', lat: 37.3891, lng: -5.9845 },
  // Italy
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'Milan', country: 'Italy', lat: 45.4642, lng: 9.1900 },
  { name: 'Naples', country: 'Italy', lat: 40.8518, lng: 14.2681 },
  { name: 'Turin', country: 'Italy', lat: 45.0703, lng: 7.6869 },
  // England
  { name: 'London', country: 'England', lat: 51.5074, lng: -0.1278 },
  { name: 'Manchester', country: 'England', lat: 53.4808, lng: -2.2426 },
  { name: 'Liverpool', country: 'England', lat: 53.4084, lng: -2.9916 },
  { name: 'Birmingham', country: 'England', lat: 52.4862, lng: -1.8904 },
  // Netherlands
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041 },
  { name: 'Rotterdam', country: 'Netherlands', lat: 51.9244, lng: 4.4777 },
  // Belgium
  { name: 'Brussels', country: 'Belgium', lat: 50.8503, lng: 4.3517 },
  // Portugal
  { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lng: -9.1393 },
  { name: 'Porto', country: 'Portugal', lat: 41.1579, lng: -8.6291 },
  // Poland
  { name: 'Warsaw', country: 'Poland', lat: 52.2297, lng: 21.0122 },
  { name: 'Krakow', country: 'Poland', lat: 50.0647, lng: 19.9450 },
  // Austria
  { name: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3738 },
  // Hungary
  { name: 'Budapest', country: 'Hungary', lat: 47.4979, lng: 19.0402 },
  // Czech Republic
  { name: 'Prague', country: 'Czech Republic', lat: 50.0755, lng: 14.4378 },
];

export const ALL_CITIES: CityLocation[] = [...ROMANIAN_CITIES, ...EUROPEAN_CITIES];

export const COUNTRIES = [
  'Romania',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'England',
  'Netherlands',
  'Belgium',
  'Portugal',
  'Poland',
  'Austria',
  'Hungary',
  'Czech Republic',
];

export const FOOTBALL_CLUB_SUFFIXES = [
  'FC',
  'United',
  'Athletic',
  'Sporting',
  'City',
  'Rangers',
  'Dynamo',
  'Real',
  'Atletico',
  'Inter',
  'Academy',
  'Stars',
  'Lions',
  'Eagles',
  'Tigers',
  'Wolves',
  'Youth',
  'Junior',
];

export const TOURNAMENT_NAME_PREFIXES = [
  'Spring',
  'Summer',
  'Autumn',
  'Winter',
  'Easter',
  'Champions',
  'Elite',
  'Regional',
  'National',
  'International',
  'Youth',
  'Junior',
  'Premier',
  'Golden',
  'Silver',
];

export const TOURNAMENT_NAME_SUFFIXES = [
  'Cup',
  'Trophy',
  'Championship',
  'League',
  'Tournament',
  'Challenge',
  'Festival',
  'Classic',
  'Open',
  'Masters',
];

export const GAME_SYSTEMS = [
  '4+1',
  '5+1',
  '6',
  '7',
  '8',
  '11',
  '5v5',
  '7v7',
  '9v9',
];

export const TOURNAMENT_TAGS = [
  'youth',
  'competitive',
  'international',
  'local',
  'friendly',
  'elite',
  'amateur',
  'professional',
  'indoor',
  'outdoor',
  'grass',
  'turf',
  'beach',
  'futsal',
];
