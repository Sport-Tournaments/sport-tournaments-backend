# Getting Started Guide

This guide will help you set up the Football Tournament Platform backend for local development.

---

## Prerequisites

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| Node.js | ≥20.0.0 | [nodejs.org](https://nodejs.org) |
| pnpm | Latest | `npm install -g pnpm` |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop) |

### Verify Installation

```bash
node --version    # Should output v20.x.x or higher
pnpm --version    # Should output version number
docker --version  # Should output version info
```

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nest-app
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Copy the environment template and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Application
PORT=3001
NODE_ENV=development

# Database - MySQL
DB_HOST=localhost
DB_PORT=3308
DB_USERNAME=root
DB_PASSWORD=root_password
DB_DATABASE=nest-app-opus

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-at-least-32-characters
JWT_REFRESH_EXPIRES_IN=7d

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6381
REDIS_PASSWORD=

# AWS S3 (or compatible storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=eu-central-1
AWS_S3_BUCKET=football-tournament-files
AWS_S3_ENDPOINT=          # Optional: for S3-compatible providers

# Stripe Payments
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# SendGrid Email
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

---

## Starting the Development Environment

### 4. Start Docker Containers

The project uses Docker for MySQL and Redis:

```bash
docker-compose up -d mysql redis
```

This starts:
- **MySQL 8.0** on port `3308` (database: `nest-app-opus`)
- **Redis 7 Alpine** on port `6381`

### 5. Verify Containers

```bash
docker-compose ps
```

Expected output:
```
NAME                    STATUS         PORTS
nest-app-opus-mysql     Up             0.0.0.0:3308->3306/tcp
nest-app-opus-redis     Up             0.0.0.0:6381->6379/tcp
```

### 6. Start the Application

```bash
# Development mode with hot reload
pnpm start:dev

# Or production mode
pnpm build
pnpm start:prod
```

The API will be available at: `http://localhost:3001`

---

## Accessing the API

### Swagger Documentation

Once running, access the interactive API documentation:

**URL:** [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

Features:
- Interactive endpoint testing
- Request/response schema documentation
- Authentication support (JWT Bearer)
- Export OpenAPI specification

### API Base URL

All API endpoints are prefixed with `/api`:

```
http://localhost:3001/api/auth/register
http://localhost:3001/api/tournaments
http://localhost:3001/api/clubs
```

---

## First Steps

### 1. Register a User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "password": "SecureP@ss123",
    "firstName": "John",
    "lastName": "Doe",
    "country": "Romania",
    "role": "ORGANIZER"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "password": "SecureP@ss123"
  }'
```

Response includes access token and refresh token:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "organizer@example.com",
      "role": "ORGANIZER"
    }
  }
}
```

### 3. Create a Club

```bash
curl -X POST http://localhost:3001/api/clubs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "FC Example Academy",
    "country": "Romania",
    "city": "Bucharest",
    "contactEmail": "contact@fcexample.com"
  }'
```

### 4. Create a Tournament (Organizers only)

```bash
curl -X POST http://localhost:3001/api/tournaments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Spring Cup 2025",
    "description": "Youth football tournament",
    "startDate": "2025-04-01",
    "endDate": "2025-04-03",
    "location": "Bucharest Sports Complex",
    "ageCategory": "U12",
    "level": "II",
    "maxTeams": 16,
    "participationFee": 250
  }'
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm start:dev` | Start in development mode with hot reload |
| `pnpm start:debug` | Start with debugging enabled |
| `pnpm start:prod` | Start in production mode |
| `pnpm build` | Build the application |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint issues |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:cov` | Run tests with coverage |

---

## Docker Commands

### Start all services
```bash
docker-compose up -d
```

### Stop all services
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f mysql
docker-compose logs -f redis
```

### Reset database
```bash
docker exec nest-app-opus-mysql mysql -uroot -proot_password \
  -e "DROP DATABASE IF EXISTS \`nest-app-opus\`; CREATE DATABASE \`nest-app-opus\`;"
```

### Access MySQL CLI
```bash
docker exec -it nest-app-opus-mysql mysql -uroot -proot_password nest-app-opus
```

### Access Redis CLI
```bash
docker exec -it nest-app-opus-redis redis-cli
```

---

## Troubleshooting

### Port Conflicts

If ports 3308 or 6381 are already in use:

1. Stop the conflicting service, or
2. Update `docker-compose.yml` to use different ports:
   ```yaml
   ports:
     - "3309:3306"  # Changed MySQL port
   ```

### Database Connection Issues

1. Verify Docker containers are running:
   ```bash
   docker-compose ps
   ```

2. Check MySQL is accepting connections:
   ```bash
   docker exec nest-app-opus-mysql mysqladmin -uroot -proot_password ping
   ```

3. Ensure `.env` matches Docker configuration:
   - `DB_PORT=3308`
   - `DB_PASSWORD=root_password`

### TypeORM Synchronization

In development, tables are auto-created. If you encounter schema issues:

1. Stop the application
2. Reset the database (see Docker Commands above)
3. Restart the application

### JWT Authentication Errors

- Ensure `JWT_SECRET` is at least 32 characters
- Access tokens expire in 15 minutes by default
- Use the refresh token endpoint for new access tokens

---

## Next Steps

- Read the [Architecture Documentation](./ARCHITECTURE.md)
- Explore the [API Reference](./API_REFERENCE.md)
- Understand [Authentication & Security](./AUTHENTICATION_SECURITY.md)
- Review the [Database Schema](./DATABASE_SCHEMA.md)
- Check the [Overview](./OVERVIEW.md) for platform features
