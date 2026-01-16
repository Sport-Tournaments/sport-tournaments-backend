import { DateOnlyTransformer } from './date.transformer';

describe('DateOnlyTransformer', () => {
  let transformer: DateOnlyTransformer;

  beforeEach(() => {
    transformer = new DateOnlyTransformer();
  });

  describe('to (write to database)', () => {
    it('should convert string to Date', () => {
      const result = transformer.to('2025-07-01');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString().split('T')[0]).toBe('2025-07-01');
    });

    it('should handle Date object', () => {
      const date = new Date('2025-07-01');
      const result = transformer.to(date);
      expect(result).toBe(date);
    });

    it('should handle null', () => {
      expect(transformer.to(null)).toBeNull();
    });

    it('should handle undefined', () => {
      expect(transformer.to(undefined)).toBeNull();
    });
  });

  describe('from (read from database)', () => {
    it('should convert Date to YYYY-MM-DD string', () => {
      const date = new Date('2025-07-01T10:30:00Z');
      const result = transformer.from(date);
      expect(result).toBe('2025-07-01');
    });

    it('should handle null', () => {
      expect(transformer.from(null)).toBeNull();
    });

    it('should handle undefined', () => {
      expect(transformer.from(undefined)).toBeNull();
    });

    it('should strip time component', () => {
      const date = new Date('2025-12-25T23:59:59.999Z');
      const result = transformer.from(date);
      expect(result).toBe('2025-12-25');
      expect(result).not.toContain('T');
      expect(result).not.toContain(':');
    });
  });
});
