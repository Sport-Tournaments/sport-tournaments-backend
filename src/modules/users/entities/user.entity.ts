import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { UserRole } from '../../../common/enums';
import { Club } from '../../clubs/entities/club.entity';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false, nullable: true })
  password?: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ nullable: true })
  phone?: string;

  @Index()
  @Column()
  country: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'email_verification_token', nullable: true })
  emailVerificationToken?: string;

  @Column({ name: 'password_reset_token', nullable: true })
  passwordResetToken?: string;

  @Column({ name: 'password_reset_expires', type: 'timestamp', nullable: true })
  passwordResetExpires?: Date;

  @Column({ name: 'profile_image_url', nullable: true })
  profileImageUrl?: string;

  // Team/Organization branding colors for dashboard theming
  @Column({ name: 'team_colors', type: 'json', nullable: true })
  teamColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };

  // Organizer-specific profile fields
  @Column({ name: 'organization_name', nullable: true })
  organizationName?: string;

  @Column({ name: 'organization_logo', nullable: true })
  organizationLogo?: string;

  @Column({ name: 'default_location', type: 'json', nullable: true })
  defaultLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    venueName: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Club, (club: Club) => club.organizer)
  clubs: Club[];

  @OneToMany(() => Tournament, (tournament: Tournament) => tournament.organizer)
  tournaments: Tournament[];

  @OneToMany(
    () => Notification,
    (notification: Notification) => notification.user,
  )
  notifications: Notification[];

  @OneToMany(
    () => RefreshToken,
    (refreshToken: RefreshToken) => refreshToken.user,
  )
  refreshTokens: RefreshToken[];

  // Virtual property for full name
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
