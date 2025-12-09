# Architecture Documentation

Technical architecture and design patterns used in the Football Tournament Platform.

---

## High-Level Architecture

```
                    ┌─────────────────────────────────────┐
                    │           Client Apps               │
                    │  (Web, Mobile, Partner Integrations)│
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │         API Gateway / CDN           │
                    │      (Rate Limiting, Caching)       │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         NestJS Application                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │    Auth     │  │  Tournaments │  │    Clubs    │  │  Payments   │  │
│  │   Module    │  │    Module    │  │   Module    │  │   Module    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │Registrations│  │   Groups    │  │   Files     │  │Notifications│  │
│  │   Module    │  │   Module    │  │   Module    │  │   Module    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│  │ Invitations │  │   Users     │  │   Admin     │                   │
│  │   Module    │  │   Module    │  │   Module    │                   │
│  └─────────────┘  └─────────────┘  └─────────────┘                   │
└───────────────────────────────────────────────────────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐  ┌─────────────┐
│   MySQL     │    │    Redis    │   │    AWS S3   │  │   Stripe    │
│  Database   │    │    Cache    │   │   Storage   │  │  Payments   │
└─────────────┘    └─────────────┘   └─────────────┘  └─────────────┘
```

---

## Framework & Technology Stack

### Core Framework

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | NestJS 11 | Backend framework |
| Language | TypeScript 5.7 | Type-safe development |
| Runtime | Node.js 20+ | JavaScript runtime |

### Data Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | MySQL 8.0 | Primary data store |
| ORM | TypeORM 0.3 | Database abstraction |
| Cache | Redis 7 | Session/query caching |

### External Services

| Component | Technology | Purpose |
|-----------|------------|---------|
| Payments | Stripe | Payment processing |
| Storage | AWS S3 | File storage |
| Email | SendGrid | Transactional emails |

---

## Module Architecture

### Module Structure

Each feature module follows this structure:

```
src/modules/tournaments/
├── tournaments.module.ts      # Module definition
├── tournaments.controller.ts  # HTTP layer
├── tournaments.service.ts     # Business logic
├── dto/                       # Data Transfer Objects
│   ├── index.ts
│   ├── create-tournament.dto.ts
│   ├── update-tournament.dto.ts
│   └── tournament-filter.dto.ts
├── entities/                  # TypeORM entities
│   ├── index.ts
│   └── tournament.entity.ts
└── services/                  # Additional services (optional)
    └── tournament-draw.service.ts
```

### Module Dependency Graph

```
AppModule
├── AuthModule
│   └── UsersModule
├── UsersModule
├── ClubsModule
│   └── UsersModule
├── TournamentsModule
│   ├── UsersModule
│   └── NotificationsModule
├── RegistrationsModule
│   ├── TournamentsModule
│   ├── ClubsModule
│   ├── PaymentsModule
│   └── NotificationsModule
├── GroupsModule
│   └── TournamentsModule
├── PaymentsModule
│   └── NotificationsModule
├── InvitationsModule
│   ├── TournamentsModule
│   ├── ClubsModule
│   └── NotificationsModule
├── NotificationsModule
├── FilesModule
└── AdminModule
    └── [All modules]
```

---

## Request/Response Flow

```
HTTP Request
    │
    ▼
┌─────────────────┐
│   Middleware    │  (Helmet, CORS, Compression)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Rate Limiter  │  (ThrottlerGuard)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Validation    │  (ValidationPipe)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Auth Guard    │  (JwtAuthGuard)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Role Guard    │  (RolesGuard)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Controller    │  (Route handler)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│    Service      │  (Business logic)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   Repository    │  (Data access)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Interceptor    │  (TransformInterceptor)
└─────────────────┘
    │
    ▼
HTTP Response
```

---

## Design Patterns

### Repository Pattern

TypeORM repositories handle data access:

```typescript
@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private tournamentRepository: Repository<Tournament>,
  ) {}

  async findAll(): Promise<Tournament[]> {
    return this.tournamentRepository.find();
  }
}
```

### Service Layer Pattern

Business logic is encapsulated in services:

```typescript
@Injectable()
export class RegistrationsService {
  async create(dto: CreateRegistrationDto, userId: string) {
    // 1. Validate tournament exists and is open
    const tournament = await this.validateTournament(dto.tournamentId);
    
    // 2. Validate user owns the club
    await this.validateClubOwnership(dto.clubId, userId);
    
    // 3. Check capacity
    await this.checkCapacity(tournament);
    
    // 4. Create registration
    const registration = await this.registrationRepository.save(dto);
    
    // 5. Send notification
    await this.notificationsService.sendRegistrationConfirmation(registration);
    
    return registration;
  }
}
```

### DTO Pattern

Data Transfer Objects for validation:

```typescript
export class CreateTournamentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsEnum(AgeCategory)
  ageCategory: AgeCategory;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  participationFee?: number;
}
```

### Guard Pattern

Custom guards for authorization:

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(
      'roles',
      context.getHandler(),
    );
    
    if (!requiredRoles) return true;
    
    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.includes(user.role);
  }
}
```

### Interceptor Pattern

Response transformation:

```typescript
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

---

## Entity Relationships

### One-to-Many

```typescript
// User has many Tournaments
@Entity()
export class User {
  @OneToMany(() => Tournament, (tournament) => tournament.organizer)
  tournaments: Tournament[];
}

@Entity()
export class Tournament {
  @ManyToOne(() => User, (user) => user.tournaments)
  @JoinColumn({ name: 'organizer_id' })
  organizer: User;
}
```

### Many-to-Many (via junction entity)

```typescript
// Clubs register to Tournaments through Registrations
@Entity()
export class Registration {
  @ManyToOne(() => Tournament)
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @ManyToOne(() => Club)
  @JoinColumn({ name: 'club_id' })
  club: Club;
}
```

---

## Caching Strategy

### Cache Levels

1. **Redis Cache** - Distributed cache for:
   - Session data
   - Tournament listings
   - User profiles

2. **Query Cache** - TypeORM query results

### Cache Invalidation

```typescript
@Injectable()
export class TournamentsService {
  async update(id: string, dto: UpdateTournamentDto) {
    const tournament = await this.tournamentRepository.save(dto);
    
    // Invalidate cache
    await this.cacheManager.del(`tournament:${id}`);
    await this.cacheManager.del('tournaments:featured');
    
    return tournament;
  }
}
```

---

## Error Handling

### Global Exception Filter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    
    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message: exception.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

### Custom Exceptions

```typescript
throw new NotFoundException('Tournament not found');
throw new ForbiddenException('Not allowed to update this tournament');
throw new ConflictException('Club already registered');
throw new BadRequestException('Tournament is not open for registration');
```

---

## Configuration Management

### Environment-Based Config

```typescript
// src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    // ...
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },
});
```

### Config Module Usage

```typescript
@Injectable()
export class AuthService {
  constructor(private configService: ConfigService) {}

  async createToken(user: User) {
    const secret = this.configService.get<string>('jwt.secret');
    const expiresIn = this.configService.get<string>('jwt.expiresIn');
    // ...
  }
}
```

---

## API Versioning

### URI Versioning

```typescript
// main.ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});

// Result: /api/v1/tournaments
```

### Controller Versioning

```typescript
@Controller({
  path: 'tournaments',
  version: '1',
})
export class TournamentsController {}

@Controller({
  path: 'tournaments',
  version: '2',
})
export class TournamentsV2Controller {}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('TournamentsService', () => {
  let service: TournamentsService;
  let repository: MockRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TournamentsService,
        { provide: getRepositoryToken(Tournament), useClass: MockRepository },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
  });

  it('should create a tournament', async () => {
    const dto = { name: 'Test Cup', ... };
    const result = await service.create('user-id', dto);
    expect(result.name).toBe('Test Cup');
  });
});
```

### E2E Tests

```typescript
describe('TournamentsController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/tournaments (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/tournaments')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });
  });
});
```

---

## Deployment Architecture

### Production Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (nginx)                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ NestJS   │   │ NestJS   │   │ NestJS   │
        │ Instance │   │ Instance │   │ Instance │
        └──────────┘   └──────────┘   └──────────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  MySQL   │   │  Redis   │   │   S3     │
        │ Primary  │   │ Cluster  │   │ Bucket   │
        │ + Replica│   │          │   │          │
        └──────────┘   └──────────┘   └──────────┘
```

### Container Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

## Monitoring & Observability

### Health Checks

```http
GET /health

{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### Logging

```typescript
const logger = new Logger('TournamentsService');
logger.log('Tournament created');
logger.warn('Capacity almost reached');
logger.error('Payment failed', error.stack);
```

### Metrics (Future)

- Request latency
- Error rates
- Database connection pool
- Cache hit/miss ratios
