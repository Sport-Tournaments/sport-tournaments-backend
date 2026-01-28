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
import { DateOnlyTransformer } from '../../../common/transformers';
import { User } from '../../users/entities/user.entity';
import { Registration } from '../../registrations/entities/registration.entity';
import { Group } from '../../groups/entities/group.entity';
import { TournamentAgeGroup } from './tournament-age-group.entity';
import { TournamentLocation } from './tournament-location.entity';
import { TournamentPot } from '../../groups/entities/tournament-pot.entity';

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
    default: TournamentStatus.PUBLISHED,
  })
  status: TournamentStatus;

  @Index()
  @Column({ name: 'start_date', type: 'date', transformer: new DateOnlyTransformer() })
  startDate: Date | string;

  @Column({ name: 'end_date', type: 'date', transformer: new DateOnlyTransformer() })
  endDate: Date | string;

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
    nullable: true,
  })
  ageCategory: AgeCategory;

  @Index()
  @Column({
    type: 'enum',
    enum: TournamentLevel,
    nullable: true,
  })
  level?: TournamentLevel;

  @Column({ name: 'game_system', nullable: true })
  gameSystem: string;

  @Column({ name: 'number_of_matches', nullable: true })
  numberOfMatches: number;

  @Column({ name: 'guaranteed_matches', nullable: true })
  guaranteedMatches: number;

  @Column({ name: 'max_teams', nullable: true })
  maxTeams: number;

  @Column({ name: 'current_teams', default: 0 })
  currentTeams: number;

  @Column({ name: 'regulations_document', nullable: true })
  regulationsDocument: string;

  @Column({ name: 'regulations_download_count', default: 0 })
  regulationsDownloadCount: number;

  @Column({ name: 'is_registration_closed', default: false })
  isRegistrationClosed: boolean;

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

  @Column({ name: 'is_published', default: true })
  isPublished: boolean;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ name: 'registration_deadline', type: 'date', nullable: true, transformer: new DateOnlyTransformer() })
  registrationDeadline?: Date | string;

  @Column({ name: 'registration_start_date', type: 'date', nullable: true, transformer: new DateOnlyTransformer() })
  registrationStartDate?: Date | string;

  @Column({ name: 'registration_end_date', type: 'date', nullable: true, transformer: new DateOnlyTransformer() })
  registrationEndDate?: Date | string;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail?: string;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone?: string;

  @Column({ name: 'whatsapp_group_link', nullable: true })
  whatsappGroupLink?: string;

  @Column({ name: 'draw_seed', nullable: true })
  drawSeed?: string;

  @Column({ name: 'draw_completed', default: false })
  drawCompleted: boolean;

  // Privacy setting: YES = private (invitation only), NO = public
  @Index()
  @Column({ name: 'is_private', default: false })
  isPrivate: boolean;

  // Invitation code for private tournaments
  @Index()
  @Column({ name: 'invitation_code', nullable: true, unique: true })
  invitationCode?: string;

  // Invitation code expiration date
  @Column({ name: 'invitation_code_expires_at', type: 'timestamp', nullable: true })
  invitationCodeExpiresAt?: Date;

  // Visibility configuration for private tournaments
  @Column({ name: 'visibility_settings', type: 'json', nullable: true })
  visibilitySettings?: {
    partnerTeams?: string[]; // Club IDs of partner teams
    pastParticipants?: string[]; // Club IDs from past tournaments
    manualEmailList?: string[]; // Additional emails to notify
    isPublicListing?: boolean; // Whether to show in public listings
  };

  // Bracket data for playoff structure
  @Column({ name: 'bracket_data', type: 'json', nullable: true })
  bracketData?: {
    type: 'groups_only' | 'groups_and_playoffs' | 'single_elimination';
    groupCount: number;
    teamsPerGroup: number;
    playoffRounds: string[];
    matches: Array<{
      matchId: string;
      stage: string;
      group?: string;
      team1Id?: string;
      team2Id?: string;
      winner?: string;
      scheduledDate?: string;
      score?: { team1: number; team2: number };
    }>;
  };

  // Regulations type tracking
  @Column({
    name: 'regulations_type',
    type: 'enum',
    enum: ['UPLOADED', 'GENERATED'],
    nullable: true,
  })
  regulationsType?: 'UPLOADED' | 'GENERATED';

  // Generated regulations data (when using form-based generation)
  @Column({ name: 'regulations_data', type: 'json', nullable: true })
  regulationsData?: {
    matchDuration: number;
    substitutionsAllowed: number;
    substitutionTiming: string;
    tieBreakingCriteria: string[];
    yellowCardRules: string;
    redCardOffenses: string[];
    fieldDimensions: string;
    equipmentRequirements: string[];
    playerEligibility: string;
  };

  // Brochure/Poster data
  @Column({ name: 'brochure_url', nullable: true })
  brochureUrl?: string;

  @Column({ name: 'social_media_assets', type: 'json', nullable: true })
  socialMediaAssets?: {
    instagramSquare?: string;
    facebookCover?: string;
    storyFormat?: string;
    pinterest?: string;
  };

  // URL slug for public tournament page
  @Column({ name: 'url_slug', nullable: true, unique: true })
  urlSlug?: string;

  @Index()
  @Column({ nullable: true })
  country?: string;

  // Group Configuration (Issue #41)
  @Column({ name: 'number_of_groups', nullable: true })
  numberOfGroups?: number;

  @Column({ name: 'group_configuration', type: 'json', nullable: true })
  groupConfiguration?: { groupLetter: string; teamCount: number }[];

  @Column({ name: 'group_config_created_at', nullable: true })
  groupConfigCreatedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Registration, (registration) => registration.tournament)
  registrations: Registration[];

  @OneToMany(() => Group, (group) => group.tournament)
  groups: Group[];

  @OneToMany(() => TournamentAgeGroup, (ageGroup) => ageGroup.tournament)
  ageGroups: TournamentAgeGroup[];

  @OneToMany(() => TournamentLocation, (location) => location.tournament)
  locations: TournamentLocation[];

  @OneToMany(() => TournamentPot, (pot) => pot.tournament)
  pots: TournamentPot[];
}
