import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LeadActivityType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Lead } from './lead.entity';

/**
 * One entry on a lead's timeline: an internal note, a logged touchpoint
 * (call/email/meeting) or a system-recorded change (status, assignee).
 */
@Entity('lead_activities')
@Index(['leadId', 'createdAt'])
export class LeadActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lead_id', type: 'uuid' })
  leadId: string;

  @ManyToOne(() => Lead, (lead) => lead.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ type: 'enum', enum: LeadActivityType })
  type: LeadActivityType;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** Structured details, e.g. `{ from, to }` for a status change. */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
