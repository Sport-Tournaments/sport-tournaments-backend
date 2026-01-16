import { ValueTransformer } from 'typeorm';

/**
 * Transformer for date-only columns (no time component)
 * Ensures dates are stored and returned in YYYY-MM-DD format
 */
export class DateOnlyTransformer implements ValueTransformer {
  /**
   * Transforms the value when writing to the database
   * @param value - Date object or string from the entity
   * @returns Date object for the database
   */
  to(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    
    if (typeof value === 'string') {
      // Parse YYYY-MM-DD string to Date
      return new Date(value);
    }
    
    return value;
  }

  /**
   * Transforms the value when reading from the database
   * @param value - Date object from the database
   * @returns YYYY-MM-DD string for the API response
   */
  from(value: Date | null | undefined): string | null {
    if (!value) return null;
    
    // Ensure we have a Date object
    const date = value instanceof Date ? value : new Date(value);
    
    // Return YYYY-MM-DD format (ISO date string without time)
    return date.toISOString().split('T')[0];
  }
}
