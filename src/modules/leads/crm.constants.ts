/** Email pattern of the scrapers' system accounts that own imported tournaments. */
export const IMPORTER_EMAIL_PATTERN = 'import.%@turnee-sportive.ro';

/** Same accounts, for matching in code. */
export const IMPORTER_EMAIL_REGEX = /^import\.[^@]+@turnee-sportive\.ro$/i;

/** Public contact shown on tournaments imported by our scrapers. */
export const IMPORTED_TOURNAMENT_CONTACT_EMAIL = 'contact@tournamente.com';
