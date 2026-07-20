---
description: "Use when creating or modifying TypeORM entities, database relations, migrations, or queries in the NestJS backend. Covers entity patterns, column conventions, relations, indexes, and repository usage."
applyTo: "src/**/*.entity.ts"
---

# Backend Database & TypeORM Patterns

## Entity Structure

All entities live in `src/modules/<feature>/entities/` or `src/common/entities/` for shared ones.

```typescript
import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, Index, JoinColumn,
} from 'typeorm';

@Entity('tournaments')
export class TournamentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true })
  description: string | null;

  @Column({ default: false })
  isActive: boolean;

  @Column({ select: false, nullable: true })  // sensitive fields hidden by default
  secretField: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Primary Keys

Always use UUID primary keys:
```typescript
@PrimaryGeneratedColumn('uuid')
id: string;
```

Never use auto-increment integers for main entities.

## Timestamps

Every entity includes both timestamp columns:
```typescript
@CreateDateColumn()
createdAt: Date;

@UpdateDateColumn()
updatedAt: Date;
```

## Relations

```typescript
// Many-to-one (owning side)
@ManyToOne(() => ClubEntity, (club) => club.tournaments, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'club_id' })
club: ClubEntity;

@Column()
clubId: string;  // explicit FK column

// One-to-many (inverse side)
@OneToMany(() => TournamentEntity, (tournament) => tournament.club)
tournaments: TournamentEntity[];

// Many-to-many with join table
@ManyToMany(() => PlayerEntity)
@JoinTable({ name: 'tournament_players' })
players: PlayerEntity[];
```

## Indexes

Add `@Index()` on columns used in WHERE clauses or JOINs:
```typescript
@Index()
@Column({ unique: true })
email: string;

@Index()
@Column()
status: TournamentStatus;
```

## Repository Pattern

Use injected TypeORM repositories. Do not use `EntityManager` directly:

```typescript
@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(TournamentEntity)
    private readonly tournamentsRepository: Repository<TournamentEntity>,
  ) {}

  async findAll(filters: FilterDto): Promise<TournamentEntity[]> {
    return this.tournamentsRepository.find({
      where: { isActive: true },
      relations: ['club', 'organizer'],
      order: { createdAt: 'DESC' },
    });
  }
}
```

For complex queries use `QueryBuilder`:
```typescript
return this.tournamentsRepository
  .createQueryBuilder('tournament')
  .leftJoinAndSelect('tournament.club', 'club')
  .where('tournament.status = :status', { status })
  .andWhere('tournament.startDate >= :date', { date })
  .orderBy('tournament.startDate', 'ASC')
  .getMany();
```

## Module Registration

Register entities in their module (not globally):
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([TournamentEntity, RegistrationEntity])],
  providers: [TournamentsService],
  controllers: [TournamentsController],
})
export class TournamentsModule {}
```

## Enum Columns

```typescript
import { TournamentStatus } from '../../common/enums/tournament-status.enum';

@Column({ type: 'enum', enum: TournamentStatus, default: TournamentStatus.DRAFT })
status: TournamentStatus;
```

All enums live in `src/common/enums/` as `SCREAMING_SNAKE_CASE` values.

## Sensitive Data

Hide sensitive columns from default queries using `{ select: false }`:
```typescript
@Column({ select: false })
password: string;
```

To include them explicitly: `.addSelect('user.password')` in QueryBuilder.
