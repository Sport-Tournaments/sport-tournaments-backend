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

@Entity('tournament_locations')
export class TournamentLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  // Venue information
  @Column({ name: 'venue_name' })
  venueName: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column()
  address: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  country?: string;

  // Facility details
  @Column({ name: 'field_count', default: 1 })
  fieldCount: number;

  @Column({ nullable: true })
  capacity?: number;

  // Field specifications
  @Column({ name: 'field_type', nullable: true })
  fieldType?: string; // e.g., "grass", "artificial", "hybrid"

  @Column({ name: 'field_dimensions', nullable: true })
  fieldDimensions?: string; // e.g., "100x64m"

  // Facilities available
  @Column({ type: 'json', nullable: true })
  facilities?: {
    changingRooms: boolean;
    showers: boolean;
    parking: boolean;
    spectatorSeating: boolean;
    floodlights: boolean;
    firstAid: boolean;
    refreshments: boolean;
  };

  // Contact for this specific venue
  @Column({ name: 'contact_name', nullable: true })
  contactName?: string;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone?: string;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail?: string;

  // Ordering for display
  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  // Primary location flag
  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
