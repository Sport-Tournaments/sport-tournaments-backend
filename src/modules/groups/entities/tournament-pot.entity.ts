import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Registration } from '../../registrations/entities/registration.entity';

@Entity('tournament_pots')
export class TournamentPot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @ManyToOne(() => Tournament, (tournament) => tournament.pots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Index()
  @Column({ name: 'registration_id' })
  registrationId: string;

  @ManyToOne(() => Registration, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;

  @Column({ name: 'pot_number', type: 'integer' })
  potNumber: number; // 1, 2, 3, or 4 (1 = strongest, 4 = weakest)

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
