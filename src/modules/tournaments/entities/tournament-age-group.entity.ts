import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Tournament } from './tournament.entity';
import { DateOnlyTransformer } from '../../../common/transformers';
import { AgeCategory, TournamentFormat, TournamentLevel } from '../../../common/enums';

// Game systems available per age category
export type GameSystem =
  | '5+1'
  | '6+1'
  | '7+1'
  | '8+1'
  | '9+1'
  | '10+1'
  | '11+1';

@Entity('tournament_age_groups')
@Index(['tournamentId', 'birthYear'], { unique: true })
export class TournamentAgeGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  // Birth year (e.g., 2015, 2014, 2013, etc.)
  @Index()
  @Column({ name: 'birth_year' })
  birthYear: number;

  @Column({
    name: 'age_category',
    type: 'enum',
    enum: AgeCategory,
    nullable: true,
  })
  ageCategory?: AgeCategory;

  @Column({
    name: 'level',
    type: 'enum',
    enum: TournamentLevel,
    nullable: true,
  })
  level?: TournamentLevel;

  @Column({
    name: 'format',
    type: 'enum',
    enum: TournamentFormat,
    nullable: true,
  })
  format?: TournamentFormat;

  // Display label (e.g., "U10", "2015")
  @Column({ name: 'display_label', nullable: true })
  displayLabel?: string;

  // Game system format (e.g., "7+1", "8+1", "11+1")
  @Column({ name: 'game_system' })
  gameSystem: string;

  // Team count must be multiple of 4
  @Column({ name: 'team_count' })
  teamCount: number;

  // Minimum teams required for this age group to be played
  @Column({ name: 'min_teams', nullable: true })
  minTeams?: number;

  // Maximum teams allowed for this age group
  @Column({ name: 'max_teams', nullable: true })
  maxTeams?: number;

  // Guaranteed number of matches per team
  @Column({ name: 'number_of_matches', nullable: true })
  numberOfMatches?: number;

  // Current registered teams for this age group
  @Column({ name: 'current_teams', default: 0 })
  currentTeams: number;

  // Guaranteed number of matches per team
  @Column({ name: 'guaranteed_matches', nullable: true })
  guaranteedMatches?: number;

  // Independent date range for this age group
  @Column({ name: 'start_date', type: 'date', transformer: new DateOnlyTransformer() })
  startDate: Date | string;

  @Column({ name: 'end_date', type: 'date', transformer: new DateOnlyTransformer() })
  endDate: Date | string;

  // Registration dates specific to this age group (optional)
  @Column({ name: 'registration_start_date', type: 'date', nullable: true, transformer: new DateOnlyTransformer() })
  registrationStartDate?: Date | string;

  @Column({ name: 'registration_end_date', type: 'date', nullable: true, transformer: new DateOnlyTransformer() })
  registrationEndDate?: Date | string;

  // Optional: assigned location ID (references TournamentLocation)
  @Column({ name: 'location_id', nullable: true })
  locationId?: string;

  // Optional: override game location address for this age group
  @Column({ name: 'location_address', nullable: true })
  locationAddress?: string;

  // Participation fee specific to this age group (optional, defaults to tournament fee)
  @Column({
    name: 'participation_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  participationFee?: number;

  // Group stage configuration
  @Column({ name: 'groups_count', nullable: true })
  groupsCount?: number;

  @Column({ name: 'teams_per_group', default: 4 })
  teamsPerGroup: number;

  @Column({ name: 'match_period_type', nullable: true })
  matchPeriodType?: 'ONE_HALF' | 'TWO_HALVES';

  @Column({ name: 'half_duration_minutes', nullable: true })
  halfDurationMinutes?: number;

  // Draw completed flag for this age group
  @Column({ name: 'draw_completed', default: false })
  drawCompleted: boolean;

  @Column({ name: 'draw_seed', nullable: true })
  drawSeed?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
