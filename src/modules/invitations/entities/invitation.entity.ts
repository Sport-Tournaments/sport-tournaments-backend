import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Club } from '../../clubs/entities/club.entity';

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export enum InvitationType {
  DIRECT = 'DIRECT', // Direct invitation to specific team
  EMAIL = 'EMAIL', // Email invitation
  PARTNER = 'PARTNER', // Partner team invitation
  PAST_PARTICIPANT = 'PAST_PARTICIPANT', // Previous tournament participant
}

@Entity('tournament_invitations')
@Index(['tournamentId', 'clubId'], { unique: true })
@Index(['tournamentId', 'email'], { unique: true })
export class TournamentInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  // Either club ID or email must be provided
  @Index()
  @Column({ name: 'club_id', nullable: true })
  clubId?: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'club_id' })
  club?: Club;

  @Index()
  @Column({ nullable: true })
  email?: string;

  // Invitation type
  @Column({
    type: 'enum',
    enum: InvitationType,
    default: InvitationType.DIRECT,
  })
  type: InvitationType;

  // Invitation status
  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  // Unique invitation token for email links
  @Column({ name: 'invitation_token', unique: true })
  invitationToken: string;

  // Custom message from organizer
  @Column({ type: 'text', nullable: true })
  message?: string;

  // Expiration date for the invitation
  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt?: Date;

  // Response date
  @Column({ name: 'responded_at', type: 'datetime', nullable: true })
  respondedAt?: Date;

  // Response message from invitee
  @Column({ name: 'response_message', type: 'text', nullable: true })
  responseMessage?: string;

  // Email sent tracking
  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  @Column({ name: 'email_sent_at', type: 'datetime', nullable: true })
  emailSentAt?: Date;

  // Reminder sent tracking
  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @Column({ name: 'reminder_sent_at', type: 'datetime', nullable: true })
  reminderSentAt?: Date;

  @Column({ name: 'reminder_count', default: 0 })
  reminderCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
