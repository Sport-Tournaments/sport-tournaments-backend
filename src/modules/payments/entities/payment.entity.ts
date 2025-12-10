import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { PaymentStatus, Currency } from '../../../common/enums';
import { Registration } from '../../registrations/entities/registration.entity';
import { User } from '../../users/entities/user.entity';
import { Tournament } from '../../tournaments/entities/tournament.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'registration_id' })
  registrationId: string;

  @OneToOne(() => Registration, (registration) => registration.payment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;

  @Index()
  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index()
  @Column({ name: 'tournament_id', nullable: true })
  tournamentId?: string;

  @ManyToOne(() => Tournament, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tournament_id' })
  tournament?: Tournament;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.EUR,
  })
  currency: Currency;

  @Index()
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Index()
  @Column({ name: 'stripe_payment_intent_id', nullable: true })
  stripePaymentIntentId?: string;

  @Column({ name: 'stripe_customer_id', nullable: true })
  stripeCustomerId?: string;

  @Column({ name: 'stripe_charge_id', nullable: true })
  stripeChargeId?: string;

  @Column({
    name: 'stripe_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  stripeFee?: number;

  @Column({ name: 'refund_id', nullable: true })
  refundId?: string;

  @Column({
    name: 'refund_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  refundAmount?: number;

  @Column({ name: 'refund_reason', nullable: true })
  refundReason?: string;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: true })
  transactionDate?: Date;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
