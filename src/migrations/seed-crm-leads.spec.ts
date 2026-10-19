import { toResearchLead } from './1792400000000-SeedCrmLeads';

type Row = Parameters<typeof toResearchLead>[0];

describe('SeedCrmLeads research row mapping', () => {
  it('maps a tournament row (dates, multi-value fields, tags, priority)', () => {
    const row: Row = [
      'Sports Festival Football Cup 2026',
      'tournament',
      '2026-06-12 to 2026-06-14',
      'upcoming',
      'Cluj-Napoca',
      'Cluj',
      'U7-U13',
      'Sports Festival',
      '+40742493385',
      'contact@sportsfestival.com; other@x.ro',
      'https://footballcup.sportsfestival.com',
      'https://footballcup.sportsfestival.com; Facebook page X',
      'Check 2027 edition',
    ];
    expect(toResearchLead(row)).toEqual({
      type: 'TOURNAMENT',
      name: 'Sports Festival Football Cup 2026',
      startDate: '2026-06-12',
      location: 'Cluj-Napoca, jud. Cluj',
      organiser: 'Sports Festival',
      contactEmail: 'contact@sportsfestival.com',
      contactPhone: '+40742493385',
      website: 'https://footballcup.sportsfestival.com',
      sourceUrl: 'https://footballcup.sportsfestival.com',
      priority: 'HIGH',
      tags: ['romania', 'tournament', 'upcoming'],
      notes: [
        'Check 2027 edition',
        'Dates: 2026-06-12 to 2026-06-14',
        'Age category: U7-U13',
        'Other emails: other@x.ro',
        'Sources: Facebook page X',
      ].join('\n'),
    });
  });

  it('maps an association row as an ORGANIZER lead without a start date', () => {
    const lead = toResearchLead([
      'Competiții județene AJF Dolj',
      'county_association',
      'sezon 2026/27',
      'recurring',
      'Craiova',
      'Dolj',
      'toate categoriile',
      'AJF Dolj',
      '+40251533505 / +40742070051',
      '',
      'https://www.frf-ajf.ro/dolj',
      'https://www.frf-ajf.ro/dolj/contact',
      '',
    ]);
    expect(lead).toMatchObject({
      type: 'ORGANIZER',
      startDate: null,
      contactEmail: null,
      location: 'Craiova, jud. Dolj',
      priority: 'LOW',
      tags: ['romania', 'county-association', 'recurring'],
    });
    expect(lead.notes).toContain('Date: sezon 2026/27');
  });

  it('omits the county when it equals the city and skips "unknown" timing', () => {
    const lead = toResearchLead([
      'Brașov Indoor Cup 2026',
      'tournament',
      '2026 (dates not captured)',
      'unknown',
      'Brașov',
      'Brașov',
      '',
      '',
      '',
      '',
      '',
      'Facebook only',
      '',
    ]);
    expect(lead.location).toBe('Brașov');
    expect(lead.tags).toEqual(['romania', 'tournament']);
    expect(lead.sourceUrl).toBeNull();
    expect(lead.notes).toContain('Sources: Facebook only');
  });
});
