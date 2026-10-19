import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { LeadPriority, LeadStatus, LeadType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Club } from '../../clubs/entities/club.entity';
import { LeadActivity } from './lead-activity.entity';

/**
 * A sales/outreach prospect tracked in the admin CRM. A lead is derived from a
 * tournament, a club or a tournament organizer (at most one lead per linked
 * record), or created manually.
 */
@Entity('leads')
// One lead per linked record; manual leads (null links) are unconstrained.
@Index('IDX_leads_tournament_unique', ['tournamentId'], {
  unique: true,
  where: '"tournament_id" IS NOT NULL',
})
@Index('IDX_leads_club_unique', ['clubId'], {
  unique: true,
  where: '"club_id" IS NOT NULL',
})
@Index('IDX_leads_organizer_unique', ['organizerId'], {
  unique: true,
  where: '"organizer_id" IS NOT NULL',
})
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: LeadType, default: LeadType.TOURNAMENT })
  type: LeadType;

  // ── Links back to the originating record (all optional) ──
  @Column({ name: 'tournament_id', type: 'uuid', nullable: true })
  tournamentId: string | null;

  @ManyToOne(() => Tournament, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament | null;

  @Column({ name: 'club_id', type: 'uuid', nullable: true })
  clubId: string | null;

  @ManyToOne(() => Club, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'club_id' })
  club: Club | null;

  /** The organizer's platform account, for ORGANIZER leads. */
  @Column({ name: 'organizer_id', type: 'uuid', nullable: true })
  organizerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'organizer_id' })
  organizer: User | null;

  // ── Denormalized details (kept even if the linked record is gone) ──
  // Column keeps its original name from when leads were tournament-only.
  @Index()
  @Column({ name: 'tournament_name' })
  name: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'text', nullable: true })
  location: string | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'text', nullable: true })
  website: string | null;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ type: 'text', nullable: true })
  organiser: string | null;

  // ── Contact details (filled in by the sales team) ──
  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName: string | null;

  @Index()
  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone: string | null;

  // ── CRM tracking ──
  @Index()
  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Index()
  @Column({ type: 'enum', enum: LeadPriority, default: LeadPriority.MEDIUM })
  priority: LeadPriority;

  /** Free-form internal summary; the running log lives in `activities`. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];

  @Index()
  @Column({ name: 'next_follow_up_at', type: 'timestamptz', nullable: true })
  nextFollowUpAt: Date | null;

  @Column({ name: 'last_contacted_at', type: 'timestamptz', nullable: true })
  lastContactedAt: Date | null;

  @Column({ name: 'lost_reason', type: 'text', nullable: true })
  lostReason: string | null;

  @Column({ name: 'assigned_to_id', type: 'uuid', nullable: true })
  assignedToId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: User | null;

  // Origin: 'young-talents-group' | 'euro-sportring' | 'platform' | 'manual'
  @Index()
  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @OneToMany(() => LeadActivity, (activity) => activity.lead)
  activities: LeadActivity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
