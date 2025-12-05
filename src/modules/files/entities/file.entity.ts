import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column()
  filename: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column()
  size: number;

  @Index()
  @Column({ name: 's3_key' })
  s3Key: string;

  @Column({ name: 's3_url' })
  s3Url: string;

  @Index()
  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @Column({ name: 'entity_type', nullable: true })
  entityType: string; // 'tournament', 'club', 'user'

  @Column({ name: 'entity_id', nullable: true })
  entityId: string;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
