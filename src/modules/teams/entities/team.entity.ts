import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { Club } from '../../clubs/entities/club.entity';
import { Registration } from '../../registrations/entities/registration.entity';

@Entity('teams')
@Index(['clubId', 'name'], { unique: true })
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'club_id' })
  clubId: string;

  @ManyToOne(() => Club, (club) => club.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'club_id' })
  club: Club;

  @Column()
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Registration, (registration) => registration.team)
  registrations: Registration[];
}
