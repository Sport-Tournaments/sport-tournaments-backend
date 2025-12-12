import { Entity, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { Language } from '../../../common/enums';

@Entity('translations')
@Unique(['key', 'language'])
export class Translation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  key: string;

  @Column({
    type: 'enum',
    enum: Language,
    default: Language.EN,
  })
  language: Language;

  @Column({ type: 'text' })
  value: string;

  @Column({ name: 'entity_type', nullable: true })
  entityType: string; // 'tournament', 'club', etc.

  @Column({ name: 'entity_id', nullable: true })
  entityId: string;

  @Column({ nullable: true })
  field: string; // 'name', 'description', etc.
}
