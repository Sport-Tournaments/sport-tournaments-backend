import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @ManyToOne(() => Tournament, (tournament) => tournament.groups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column({ name: 'group_letter' })
  groupLetter: string;

  @Column({ type: 'json' })
  teams: string[]; // Array of registration IDs

  @Column({ name: 'group_order', default: 0 })
  groupOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
