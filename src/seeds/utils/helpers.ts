import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';

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
 * Get a random date in the past
 */
export function getRandomPastDate(years: number = 2): Date {
  return faker.date.past({ years });
}

/**
 * Get a random date in the future
 */
export function getRandomFutureDate(years: number = 1): Date {
  return faker.date.future({ years });
}

/**
 * Get a random date between two dates
 */
export function getRandomDateBetween(start: Date, end: Date): Date {
  return faker.date.between({ from: start, to: end });
}

/**
 * Get a date range (start + end date for tournaments)
 */
export function getTournamentDateRange(isUpcoming: boolean = true): { startDate: Date; endDate: Date } {
  let startDate: Date;
  
  if (isUpcoming) {
    startDate = faker.date.future({ years: 1 });
  } else {
    startDate = faker.date.past({ years: 1 });
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
export function pickRandomMultiple<T>(array: T[], count: { min: number; max: number }): T[] {
  return faker.helpers.arrayElements(array, count);
}

/**
 * Weighted random selection
 */
export function weightedRandom<T>(items: Array<{ value: T; weight: number }>): T {
  return faker.helpers.weightedArrayElement(items);
}

/**
 * Generate a realistic tournament fee
 */
export function generateTournamentFee(): number {
  return faker.helpers.arrayElement([50, 75, 100, 125, 150, 200, 250, 300, 350, 400, 500]);
}

/**
 * Generate team colors for organizer
 */
export function generateTeamColors(): { primary: string; secondary: string; accent: string } {
  return {
    primary: faker.color.rgb({ format: 'hex' }),
    secondary: faker.color.rgb({ format: 'hex' }),
    accent: faker.color.rgb({ format: 'hex' }),
  };
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
