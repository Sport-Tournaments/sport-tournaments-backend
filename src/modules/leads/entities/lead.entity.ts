import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LeadStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Tournament } from '../../tournaments/entities/tournament.entity';

/**
 * A sales/outreach lead tracked in the admin CRM. Usually derived from a
 * tournament (one lead per tournament), but can also be created manually.
 */
@Entity('leads')
// One lead per tournament; manual leads (null tournament_id) are unconstrained.
@Index('IDX_leads_tournament_unique', ['tournamentId'], {
  unique: true,
  where: '"tournament_id" IS NOT NULL',
})
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Link back to the originating tournament (optional) ──
  @Column({ name: 'tournament_id', type: 'uuid', nullable: true })
  tournamentId: string | null;

  @ManyToOne(() => Tournament, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament | null;

  // ── Denormalized tournament details (kept even if the tournament is gone) ──
  @Index()
  @Column({ name: 'tournament_name' })
  tournamentName: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'text', nullable: true })
  location: string | null;

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

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'assigned_to_id', type: 'uuid', nullable: true })
  assignedToId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: User | null;

  // Origin: 'young-talents-group' | 'euro-sportring' | 'platform' | 'manual'
  @Index()
  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
