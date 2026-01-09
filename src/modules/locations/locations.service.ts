import { Injectable } from '@nestjs/common';

interface LocationSuggestion {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  region?: string;
}

@Injectable()
export class LocationsService {
  private readonly cities: LocationSuggestion[] = [
    // Major Romanian cities with coordinates
    { name: 'Bucharest', latitude: 44.4268, longitude: 26.1025, country: 'Romania', region: 'Bucharest' },
    { name: 'Iași', latitude: 47.1605, longitude: 27.5906, country: 'Romania', region: 'Iași' },
    { name: 'Cluj-Napoca', latitude: 46.7712, longitude: 23.6236, country: 'Romania', region: 'Cluj' },
    { name: 'Timișoara', latitude: 45.7489, longitude: 21.2087, country: 'Romania', region: 'Timiș' },
    { name: 'Constanța', latitude: 44.1598, longitude: 28.6548, country: 'Romania', region: 'Constanța' },
    { name: 'Craiova', latitude: 44.3302, longitude: 23.8103, country: 'Romania', region: 'Dolj' },
    { name: 'Brașov', latitude: 45.6428, longitude: 24.5780, country: 'Romania', region: 'Brașov' },
    { name: 'Galați', latitude: 45.4354, longitude: 28.0296, country: 'Romania', region: 'Galați' },
    { name: 'Oradea', latitude: 47.0403, longitude: 21.9244, country: 'Romania', region: 'Bihor' },
    { name: 'Pitești', latitude: 44.8488, longitude: 24.8692, country: 'Romania', region: 'Argeș' },
    { name: 'Sibiu', latitude: 45.7979, longitude: 24.1269, country: 'Romania', region: 'Sibiu' },
    { name: 'Bacău', latitude: 46.5754, longitude: 26.9218, country: 'Romania', region: 'Bacău' },
    { name: 'Ploiești', latitude: 44.9412, longitude: 25.5711, country: 'Romania', region: 'Prahova' },
    { name: 'Arad', latitude: 46.1835, longitude: 21.3143, country: 'Romania', region: 'Arad' },
    { name: 'Buzău', latitude: 45.1426, longitude: 26.8242, country: 'Romania', region: 'Buzău' },
    { name: 'Drobeta-Turnu Severin', latitude: 44.6366, longitude: 22.6597, country: 'Romania', region: 'Mehedinți' },
    { name: 'Satu Mare', latitude: 47.7883, longitude: 22.8746, country: 'Romania', region: 'Satu Mare' },
    { name: 'Piatra Neamț', latitude: 46.9245, longitude: 26.2151, country: 'Romania', region: 'Neamț' },
    { name: 'Baia Mare', latitude: 47.6621, longitude: 23.5743, country: 'Romania', region: 'Maramureș' },
    { name: 'Tulcea', latitude: 45.1869, longitude: 28.7942, country: 'Romania', region: 'Tulcea' },
    { name: 'Vatra Moldoviței', latitude: 47.5256, longitude: 25.2636, country: 'Romania', region: 'Suceava' },
    { name: 'Suceava', latitude: 47.6491, longitude: 26.2632, country: 'Romania', region: 'Suceava' },
    { name: 'Focșani', latitude: 45.7033, longitude: 27.1897, country: 'Romania', region: 'Vrancea' },
    { name: 'Câmpulung-Muscel', latitude: 45.1126, longitude: 24.8833, country: 'Romania', region: 'Argeș' },
    { name: 'Obor', latitude: 45.1364, longitude: 28.1606, country: 'Romania', region: 'Constanța' },
  ];

  autocomplete(query: string, limit: number = 10): LocationSuggestion[] {
    if (!query || query.trim().length === 0) {
      return this.cities.slice(0, limit);
    }

    const queryLower = query.toLowerCase();
    const filtered = this.cities.filter((city) =>
      city.name.toLowerCase().includes(queryLower) ||
      (city.region && city.region.toLowerCase().includes(queryLower))
    );

    return filtered.slice(0, limit);
  }
}
