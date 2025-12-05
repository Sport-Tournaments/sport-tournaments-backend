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
import {
  TournamentStatus,
  TournamentLevel,
  Currency,
  AgeCategory,
} from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Registration } from '../../registrations/entities/registration.entity';
import { Group } from '../../groups/entities/group.entity';

@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ fulltext: true })
  @Column()
  name: string;

  @Column({ name: 'organizer_id' })
  organizerId: string;

  @ManyToOne(() => User, (user) => user.tournaments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizer_id' })
  organizer: User;

  @Index({ fulltext: true })
  @Column({ type: 'text', nullable: true })
  description: string;

  @Index()
  @Column({
    type: 'enum',
    enum: TournamentStatus,
    default: TournamentStatus.DRAFT,
  })
  status: TournamentStatus;

  @Index()
  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column()
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Index()
  @Column({
    name: 'age_category',
    type: 'enum',
    enum: AgeCategory,
  })
  ageCategory: AgeCategory;

  @Index()
  @Column({
    type: 'enum',
    enum: TournamentLevel,
    default: TournamentLevel.LEVEL_II,
  })
  level: TournamentLevel;

  @Column({ name: 'game_system', nullable: true })
  gameSystem: string;

  @Column({ name: 'number_of_matches', nullable: true })
  numberOfMatches: number;

  @Column({ name: 'max_teams' })
  maxTeams: number;

  @Column({ name: 'current_teams', default: 0 })
  currentTeams: number;

  @Column({ name: 'regulations_document', nullable: true })
  regulationsDocument: string;

  @Column({ name: 'regulations_download_count', default: 0 })
  regulationsDownloadCount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.EUR,
  })
  currency: Currency;

  @Column({
    name: 'participation_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  participationFee: number;

  @Column({ name: 'is_premium', default: false })
  isPremium: boolean;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ name: 'registration_deadline', type: 'date', nullable: true })
  registrationDeadline?: Date;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail?: string;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone?: string;

  @Column({ name: 'draw_seed', nullable: true })
  drawSeed?: string;

  @Column({ name: 'draw_completed', default: false })
  drawCompleted: boolean;

  @Index()
  @Column({ nullable: true })
  country?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Registration, (registration) => registration.tournament)
  registrations: Registration[];

  @OneToMany(() => Group, (group) => group.tournament)
  groups: Group[];
}
