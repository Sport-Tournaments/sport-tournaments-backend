import {
  IMPORTED_TOURNAMENT_CONTACT_EMAIL,
  IMPORTER_EMAIL_REGEX,
} from '../leads/crm.constants';

/**
 * Tournaments imported by our scrapers belong to system accounts
 * (import.<source>@turnee-sportive.ro). Never show those addresses publicly:
 * use our inbox as the contact and drop the system account's email.
 */
export function withPublicContactEmail<
  T extends { contactEmail?: string; organizer?: { email?: string } },
>(tournament: T): T {
  const organizerEmail = tournament.organizer?.email;
  if (!organizerEmail || !IMPORTER_EMAIL_REGEX.test(organizerEmail)) {
    return tournament;
  }

  const contactEmail =
    !tournament.contactEmail ||
    IMPORTER_EMAIL_REGEX.test(tournament.contactEmail)
      ? IMPORTED_TOURNAMENT_CONTACT_EMAIL
      : tournament.contactEmail;

  return {
    ...tournament,
    contactEmail,
    organizer: {
      ...tournament.organizer,
      email: IMPORTED_TOURNAMENT_CONTACT_EMAIL,
    },
  };
}
