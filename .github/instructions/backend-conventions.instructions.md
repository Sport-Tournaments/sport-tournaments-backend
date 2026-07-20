---
description: "Use when creating or modifying NestJS backend files: modules, services, controllers, DTOs, guards, decorators, interceptors, or filters. Covers module architecture, naming conventions, dependency injection, and code organization."
applyTo: "src/**/*.ts"
---

# Backend NestJS Conventions

## Module Structure

Every feature lives in `src/modules/<feature>/` and follows this layout:

```
modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── dto/
│   ├── login.dto.ts
│   └── register.dto.ts
├── entities/
│   └── refresh-token.entity.ts
├── guards/
│   └── jwt-auth.guard.ts
├── strategies/
│   └── jwt.strategy.ts
└── index.ts          ← barrel export of public API
```

Shared cross-module code goes in `src/common/` (decorators, dto, entities, enums, filters, interceptors, interfaces, transformers).

## Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Files | `kebab-case.type.ts` | `auth.service.ts`, `jwt.strategy.ts` |
| Classes | `PascalCase` | `JwtAuthGuard`, `AuthService` |
| Methods/props | `camelCase` | `getCurrentUser()`, `isActive` |
| Enums/constants | `SCREAMING_SNAKE_CASE` | `ROLES_KEY`, `UserRole.ADMIN` |
| DTOs | `PascalCase` + `Dto` suffix | `RegisterDto`, `UpdateTournamentDto` |
| Entities | `PascalCase` + `Entity` suffix (class), `.entity.ts` (file) | `UserEntity`, `user.entity.ts` |

## DTO Validation Pattern

Always use `class-validator` decorators + `@ApiProperty` for Swagger:

```typescript
import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @IsEmail()
  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @IsString()
  @MinLength(8)
  @ApiProperty()
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  @ApiPropertyOptional({ enum: UserRole })
  role?: UserRole = UserRole.PARTICIPANT;
}
```

`ValidationPipe` is global with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

## Controller Pattern

```typescript
@ApiTags('tournaments')
@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  @Public()  // bypass auth on public endpoints
  @ApiOperation({ summary: 'List tournaments' })
  findAll(@Query() query: FilterTournamentsDto) {
    return this.tournamentsService.findAll(query);
  }

  @Post()
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTournamentDto, @CurrentUser() user: JwtPayload) {
    return this.tournamentsService.create(dto, user);
  }
}
```

## Custom Decorators

Three key decorators in `src/common/decorators/`:
- `@Public()` — skip `JwtAuthGuard`
- `@Roles(...roles)` — set required roles (used with `RolesGuard`)
- `@CurrentUser()` — extract `JwtPayload` from request

## Barrel Exports

Every module exposes a public API through `index.ts`:

```typescript
// modules/auth/index.ts
export { AuthModule } from './auth.module';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { JwtPayload } from './interfaces/jwt-payload.interface';
```

## Global Bootstrap (main.ts)

- `ValidationPipe` applied globally with `transform: true`
- `AllExceptionsFilter` applied globally
- `TransformInterceptor` applied globally (wraps responses)
- URI versioning: default version `1`
- Swagger only enabled in non-production
