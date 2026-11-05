import { withPublicContactEmail } from './public-contact';

describe('withPublicContactEmail', () => {
  it('replaces the importer system address with our inbox', () => {
    const result = withPublicContactEmail({
      name: 'Cup',
      contactEmail: undefined as string | undefined,
      organizer: { email: 'import.eurosportring@turnee-sportive.ro' },
    });

    expect(result.contactEmail).toBe('contact@tournamente.com');
    expect(result.organizer?.email).toBe('contact@tournamente.com');
  });

  it("keeps an imported tournament's real contact email", () => {
    const result = withPublicContactEmail({
      contactEmail: 'office@club.ro',
      organizer: { email: 'import.youngtalentsgroup@turnee-sportive.ro' },
    });

    expect(result.contactEmail).toBe('office@club.ro');
  });

  it('leaves tournaments of real organizers untouched', () => {
    const tournament = {
      contactEmail: undefined as string | undefined,
      organizer: { email: 'organizer@club.ro' },
    };

    expect(withPublicContactEmail(tournament)).toBe(tournament);
  });
});
