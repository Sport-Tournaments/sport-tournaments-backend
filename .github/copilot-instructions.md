# Copilot instructions for sport-tournaments-backend

## Architecture & data flow
- NestJS 11 API with global prefix + URI versioning: /api/v1/... (see src/main.ts).
- Request flow: ValidationPipe (whitelist + forbidNonWhitelisted) → guards → controllers → services → repositories → TransformInterceptor response envelope.
- Response envelope:
  - Success: { success: true, data: ... } (common/interceptors/transform.interceptor.ts).
  - Errors: { success: false, error: { code, message, details? } } (common/filters/all-exceptions.filter.ts).
- Feature modules live in src/modules/* and follow module/controller/service/dto/entities pattern (see docs/ARCHITECTURE.md).
- Swagger is enabled only in development at /api/docs and /api/swagger-json (src/main.ts).
- Health check endpoint: GET /health (src/main.ts).

## Database & config
- PostgreSQL only. DATABASE_URL is required and must start with postgres:// or postgresql:// (src/config/database.config.ts).
- TypeORM auto-loads entities and synchronizes in dev; config is driven via src/config/configuration.ts.
- ConfigModule loads .env.local then .env (src/app.module.ts).
- CORS uses CORS_ORIGINS and allows local network origins in dev; credentials are enabled (src/main.ts).

## External integrations
- Stripe payments, S3-compatible storage (MinIO in docker-compose), SendGrid email; see docker-compose.yml env vars.
- Throttler defaults to 100 req/min (src/app.module.ts).

## Developer workflows
- pnpm start:dev (dev server)
- pnpm test:e2e (E2E)
- pnpm seed (seed data)
- Docker stack: postgres, redis, minio via docker-compose.yml

## Conventions & examples
- DTO validation is mandatory; unknown fields are rejected.
- Prefer returning domain data and let TransformInterceptor wrap it.
- Use standardized error codes from AllExceptionsFilter when throwing HTTP exceptions.
