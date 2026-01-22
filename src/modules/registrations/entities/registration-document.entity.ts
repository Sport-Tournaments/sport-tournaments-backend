import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Registration } from './registration.entity';

export enum DocumentType {
  MEDICAL_DECLARATION = 'MEDICAL_DECLARATION',
  PARENTAL_CONSENT = 'PARENTAL_CONSENT',
  ID_DOCUMENT = 'ID_DOCUMENT',
  PLAYER_PHOTO = 'PLAYER_PHOTO',
  COACH_LICENSE = 'COACH_LICENSE',
  INSURANCE = 'INSURANCE',
  OTHER = 'OTHER',
}

@Entity('registration_documents')
@Index(['registrationId', 'documentType'])
export class RegistrationDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'registration_id' })
  registrationId: string;

  @ManyToOne(() => Registration, (registration) => registration.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'registration_id' })
  registration: Registration;

  @Column({
    type: 'enum',
    enum: DocumentType,
    name: 'document_type',
  })
  documentType: DocumentType;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
