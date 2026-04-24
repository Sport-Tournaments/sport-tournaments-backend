---
description: "Use when working on API endpoints, authentication, authorization, request/response handling, guards, or error handling in the NestJS backend. Covers JWT auth flow, role-based access, standard response format, and exception handling."
applyTo: "src/**/*.ts"
---

# Backend API, Auth & Response Patterns

## API Versioning & Base URL

All endpoints are versioned via URI: `/api/v1/<resource>`.

- Configured with `VersioningType.URI`, default version `'1'`
- Global prefix: `api`
- Example: `POST /api/v1/auth/login`

## Standard API Response Format

All responses are wrapped by `TransformInterceptor` into this shape:

```typescript
// Success
{ "success": true, "data": <payload> }

// Success with message
{ "success": true, "data": <payload>, "message": "Tournament created" }

// Error (from AllExceptionsFilter)
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials",
    "details": []
  }
}
```

**Never** return raw objects from controllers — the interceptor handles wrapping. Just return plain data or throw NestJS exceptions.

## HTTP Status → Error Code Mapping

| Status | Code |
|---|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `UNPROCESSABLE_ENTITY` |
| 500 | `INTERNAL_SERVER_ERROR` |

Throw standard NestJS exceptions:
```typescript
throw new NotFoundException('Tournament not found');
throw new ConflictException('Email already exists');
throw new UnauthorizedException('Invalid credentials');
```

## JWT Authentication

Two-token system:
- **Access token**: 15 min expiry, in `Authorization: Bearer` header
- **Refresh token**: 60 days expiry, stored in `refresh_tokens` table

```typescript
// JWT payload shape (JwtPayload interface)
interface JwtPayload {
  sub: string;   // user UUID
  email: string;
  role: UserRole;
}
```

### Auth Flow
1. `POST /api/v1/auth/login` → returns `{ accessToken, refreshToken, user }`
2. `POST /api/v1/auth/refresh` → exchange refresh token for new access token
3. `POST /api/v1/auth/logout` → revoke refresh token

## Role-Based Access Control

Four roles in ascending privilege:
```typescript
enum UserRole {
  USER = 'USER',
  PARTICIPANT = 'PARTICIPANT',
  ORGANIZER = 'ORGANIZER',
  ADMIN = 'ADMIN',
}
```

Apply to controller methods:
```typescript
// Bypass JWT entirely (public endpoint)
@Public()
@Get()
findAll() {}

// Require specific roles (also requires JwtAuthGuard)
@Roles(UserRole.ORGANIZER, UserRole.ADMIN)
@Post()
create() {}

// Get current user from token
@Get('me')
getMe(@CurrentUser() user: JwtPayload) {
  return this.usersService.findOne(user.sub);
}
```

`JwtAuthGuard` is applied globally. `@Public()` is the escape hatch.

## Rate Limiting

`ThrottlerGuard` is globally registered. Default: 100 requests / 60s per IP. Apply `@Throttle({ default: { ttl: 60000, limit: 10 } })` on sensitive endpoints (login, register).

## Security Headers

`helmet()` is enabled globally in `main.ts`. CORS origins come from `config.cors.origins` (env: `CORS_ORIGINS`).
