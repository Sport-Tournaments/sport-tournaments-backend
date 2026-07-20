import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
// Tree-shaking safe: imports only the RO locale bundle
import { faker } from '@faker-js/faker/locale/ro';

export { faker };

// ── Seed date boundaries ──────────────────────────────────
export const SEED_DATE_FROM = new Date('2025-10-01');
export const SEED_DATE_TO = new Date('2026-10-01');

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Generate a Stripe-like payment intent ID
 */
export function generateStripePaymentIntentId(): string {
  return `pi_${faker.string.alphanumeric(24)}`;
}

/**
 * Generate a Stripe-like customer ID
 */
export function generateStripeCustomerId(): string {
  return `cus_${faker.string.alphanumeric(14)}`;
}

/**
 * Generate a Stripe-like charge ID
 */
export function generateStripeChargeId(): string {
  return `ch_${faker.string.alphanumeric(24)}`;
}

/**
 * Generate a Stripe-like refund ID
 */
export function generateStripeRefundId(): string {
  return `re_${faker.string.alphanumeric(24)}`;
}

/**
 * Generate a random invitation token
 */
export function generateInvitationToken(): string {
  return faker.string.alphanumeric(32);
}

/**
 * Generate a verification token
 */
export function generateVerificationToken(): string {
  return faker.string.alphanumeric(64);
}

/**
 * Get a random phone number in Romanian format
 */
export function generateRomanianPhone(): string {
  return `+40 7${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
}

/**
 * Random date inside the seed window (Oct 2025 → Oct 2026)
 */
export function seedDate(): Date {
  return faker.date.between({ from: SEED_DATE_FROM, to: SEED_DATE_TO });
}

/**
 * Random date inside the first half of the seed window (Oct 2025 → Apr 2026)
 * Useful for "past" data relative to the window midpoint
 */
export function seedDatePast(): Date {
  return faker.date.between({
    from: SEED_DATE_FROM,
    to: new Date('2026-04-01'),
  });
}

/**
 * Random date inside the second half of the seed window (Apr 2026 → Oct 2026)
 * Useful for "future" data relative to the window midpoint
 */
export function seedDateFuture(): Date {
  return faker.date.between({
    from: new Date('2026-04-01'),
    to: SEED_DATE_TO,
  });
}

/**
 * Get a random date between two dates
 */
export function getRandomDateBetween(start: Date, end: Date): Date {
  return faker.date.between({ from: start, to: end });
}

/**
 * Get a tournament date range inside the seed window.
 * @param status - determines whether dates are in the past or future half
 */
export function getTournamentDateRange(
  status: 'past' | 'upcoming' | 'ongoing',
): { startDate: Date; endDate: Date } {
  let startDate: Date;

  switch (status) {
    case 'past':
      startDate = faker.date.between({
        from: SEED_DATE_FROM,
        to: new Date('2026-01-15'),
      });
      break;
    case 'ongoing':
      startDate = faker.date.between({
        from: new Date('2026-02-10'),
        to: new Date('2026-02-16'),
      });
      break;
    case 'upcoming':
    default:
      startDate = faker.date.between({
        from: new Date('2026-03-01'),
        to: new Date('2026-09-15'),
      });
      break;
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + faker.number.int({ min: 1, max: 3 }));

  return { startDate, endDate };
}

/**
 * Pick a random item from an array
 */
export function pickRandom<T>(array: T[]): T {
  return faker.helpers.arrayElement(array);
}

/**
 * Pick multiple random items from an array
 */
export function pickRandomMultiple<T>(
  array: T[],
  count: { min: number; max: number },
): T[] {
  return faker.helpers.arrayElements(array, count);
}

/**
 * Weighted random selection
 */
export function weightedRandom<T>(
  items: Array<{ value: T; weight: number }>,
): T {
  return faker.helpers.weightedArrayElement(items);
}

/**
 * Generate a realistic tournament fee (RON)
 */
export function generateTournamentFee(): number {
  return faker.helpers.arrayElement([
    200, 300, 400, 500, 600, 750, 1000, 1200, 1500, 2000,
  ]);
}

/**
 * Generate team colors for organizer
 */
export function generateTeamColors(): {
  primary: string;
  secondary: string;
  accent: string;
} {
  return {
    primary: faker.color.rgb({ format: 'hex' }),
    secondary: faker.color.rgb({ format: 'hex' }),
    accent: faker.color.rgb({ format: 'hex' }),
  };
}

/**
 * Format a Date to YYYY-MM-DD string (for date-only columns)
 */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Shuffle array
 */
export function shuffleArray<T>(array: T[]): T[] {
  return faker.helpers.shuffle([...array]);
}
