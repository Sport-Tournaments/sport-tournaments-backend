# Football Tournament Platform - AI Coding Instructions

## Architecture Overview

This is a **NestJS 11** backend for managing youth football tournaments. The architecture follows NestJS conventions with domain-driven module organization.

### Module Structure
```
src/modules/
├── auth/         # JWT authentication, refresh tokens, guards
├── users/        # User profiles and management
├── clubs/        # Football clubs (owned by organizers)
├── tournaments/  # Tournament CRUD, lifecycle management
├── registrations/# Club registration to tournaments
├── groups/       # Tournament draw and bracket system
├── payments/     # Stripe integration
├── notifications/# User notifications
├── files/        # S3 file uploads
├── admin/        # Admin-only operations
└── translations/ # i18n support
```

### Data Flow
Clubs → Register to Tournaments → Groups assigned via Draw → Payments processed → Notifications sent

## Critical Patterns

### Entity Definitions
- Use **UUID** primary keys: `@PrimaryGeneratedColumn('uuid')`
- Column naming uses **snake_case** in DB: `@Column({ name: 'organizer_id' })`
- Avoid combining `@Index()` with `@Column({ unique: true })` on same field (causes duplicate index names)
- For fulltext search indexes, provide explicit name: `@Index('IDX_custom_name', { fulltext: true })`

### Authentication & Authorization
Controllers use dual guards pattern:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
```

Use decorators from `src/common/decorators/`:
- `@CurrentUser()` - Injects JWT payload into handler
- `@Roles(UserRole.ORGANIZER)` - Restricts to specific roles
- `@Public()` - Bypasses JWT requirement

User roles hierarchy: `ADMIN > ORGANIZER > PARTICIPANT > USER`

### Service Authorization Pattern
Services receive `userId` and `userRole` as parameters, not the request object:
```typescript
async update(id: string, userId: string, userRole: string, dto: UpdateDto) {
  // Check ownership or admin role
  if (entity.organizerId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenException('Not allowed');
  }
}
```

### DTOs and Validation
- DTOs use `class-validator` decorators with `class-transformer`
- All DTOs in module's `dto/` folder with barrel export
- Use `PaginationDto` from `src/common/dto/` for list endpoints

## Development Workflow

### Running Locally
```bash
# Start MySQL (port 3307) and Redis (port 6380) in Docker
docker-compose up -d mysql redis

# Start NestJS in watch mode
pnpm start:dev
```

### Database
- TypeORM with `synchronize: true` in development (auto-creates tables)
- MySQL 8.0 with `utf8mb4_unicode_ci` collation
- Reset database: `docker exec football-tournament-mysql mysql -uroot -proot_password -e "DROP DATABASE football_tournament; CREATE DATABASE football_tournament;"`

### API Documentation
Swagger available at `http://localhost:3000/api/docs` when running

## Enums Reference (src/common/enums/)
- `UserRole`: ADMIN, ORGANIZER, PARTICIPANT, USER
- `TournamentStatus`: DRAFT → PUBLISHED → ONGOING → COMPLETED/CANCELLED
- `RegistrationStatus`: PENDING → APPROVED/REJECTED/WITHDRAWN
- `PaymentStatus`: PENDING → COMPLETED/FAILED/REFUNDED
- `AgeCategory`: U8, U10, U12, U14, U16, U18, U21, SENIOR, VETERANS
- `TournamentLevel`: I, II, III

## External Integrations
- **Stripe**: Payment processing (configured via `STRIPE_SECRET_KEY`)
- **AWS S3**: File storage (supports compatible providers via `AWS_S3_ENDPOINT`)
- **SendGrid**: Email notifications

## Common Gotchas
1. JWT expires in 15 minutes; use refresh token flow for long sessions
2. Tournament status transitions are enforced (can't skip PUBLISHED → ONGOING)
3. Registration requires tournament to be PUBLISHED and have available slots
4. Draw can only be executed once per tournament (`drawCompleted` flag)
