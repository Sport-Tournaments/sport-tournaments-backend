import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { RegistrationStatus, PaymentStatus, Currency } from '../../../common/enums';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { TournamentAgeGroup } from '../../tournaments/entities/tournament-age-group.entity';
import { Club } from '../../clubs/entities/club.entity';
import { Team } from '../../teams/entities/team.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { User } from '../../users/entities/user.entity';
import { RegistrationDocument } from './registration-document.entity';

@Entity('registrations')
@Index(['tournamentId', 'clubId', 'teamId', 'ageGroupId'], { unique: true })
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @ManyToOne(() => Tournament, (tournament) => tournament.registrations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Index()
  @Column({ name: 'age_group_id', nullable: true })
  ageGroupId?: string;

  @ManyToOne(() => TournamentAgeGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'age_group_id' })
  ageGroup?: TournamentAgeGroup;

  @Index()
  @Column({ name: 'club_id' })
  clubId: string;

  @ManyToOne(() => Club, (club) => club.registrations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'club_id' })
  club: Club;

  @Index()
  @Column({ name: 'team_id', nullable: true })
  teamId?: string;

  @ManyToOne(() => Team, (team) => team.registrations, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_id' })
  team?: Team;

  @Column({
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.PENDING,
  })
  status: RegistrationStatus;

  @Column({ name: 'group_assignment', nullable: true })
  groupAssignment?: string;

  @Column({ name: 'number_of_players', nullable: true })
  numberOfPlayers?: number;

  @Column({ name: 'coach_name', nullable: true })
  coachName?: string;

  @Column({ name: 'coach_phone', nullable: true })
  coachPhone?: string;

  @Column({ name: 'emergency_contact', nullable: true })
  emergencyContact: string;

  // BE-03: flag set when team age category/birth year doesn't match the selected age group
  @Column({ name: 'age_category_mismatch', default: false })
  ageCategoryMismatch: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  // Review/approval workflow fields
  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy?: User;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes?: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  @CreateDateColumn({ name: 'registration_date' })
  registrationDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Fitness confirmation fields
  @Column({ name: 'fitness_confirmed', default: false })
  fitnessConfirmed: boolean;

  @Column({ name: 'fitness_confirmed_by_id', nullable: true })
  fitnessConfirmedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fitness_confirmed_by_id' })
  fitnessConfirmedBy?: User;

  @Column({ name: 'fitness_confirmed_at', type: 'timestamp', nullable: true })
  fitnessConfirmedAt?: Date;

  @Column({ name: 'fitness_notes', type: 'text', nullable: true })
  fitnessNotes?: string;

  // ----- Price / payment tracking (Issue #88) -----
  @Column({
    name: 'price_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  priceAmount?: number;

  @Column({
    name: 'price_currency',
    type: 'enum',
    enum: Currency,
    nullable: true,
  })
  priceCurrency?: Currency;

  @Column({ name: 'paid', default: false })
  paid: boolean;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  paidAmount?: number;

  @OneToOne(() => Payment, (payment) => payment.registration)
  payment: Payment;

  @OneToMany(() => RegistrationDocument, (document) => document.registration)
  documents: RegistrationDocument[];
}
