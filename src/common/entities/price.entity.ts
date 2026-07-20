import { Column } from 'typeorm';
import { Currency } from '../enums';

/**
 * Price embeddable value object: stores amount + currency as a reusable unit.
 * Embed in any entity that needs to represent a monetary value.
 */
export class Price {
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.EUR,
  })
  currency: Currency;
}
