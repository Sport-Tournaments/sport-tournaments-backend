import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  Index,
} from 'typeorm';
import { Team } from '../../teams/entities/team.entity';

@Entity('players')
@Index(['firstname', 'lastname'])
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstname: string;

  @Column()
  lastname: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: string;

  @ManyToMany(() => Team, (team) => team.players)
  teams: Team[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
