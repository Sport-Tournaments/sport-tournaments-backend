import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { NotificationType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'related_tournament_id', nullable: true })
  relatedTournamentId: string;

  @Column({ name: 'related_registration_id', nullable: true })
  relatedRegistrationId: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'send_email_notification', default: true })
  sendEmailNotification: boolean;

  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
