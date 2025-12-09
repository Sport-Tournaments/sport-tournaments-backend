# Football Tournament Platform - Technical Overview

## Project Summary

The **Football Tournament Platform** is a comprehensive backend system designed to manage youth football tournaments across Europe. Built with **NestJS 11**, it provides a robust, scalable API for tournament organizers, clubs, and participants.

---

## Key Features

### 🏆 Tournament Management
- Complete tournament lifecycle (Draft → Published → Ongoing → Completed/Cancelled)
- Multi-age group support (U8 through Veterans)
- Three tournament levels (I, II, III) for competitive categorization
- Privacy controls with visibility settings
- Multiple bracket types (knockout, round-robin, Swiss system, double elimination)

### 👥 User & Club Management
- Role-based access control (Admin, Organizer, Participant, User)
- Club verification and premium tiers
- Organizer profiles with team colors and branding

### 📝 Registration System
- Club registration to tournaments
- Status workflow (Pending → Approved/Rejected/Withdrawn)
- Capacity management with max team limits

### 🎯 Tournament Draw & Groups
- Automated group generation
- Pot-based seeding system
- Draw locking mechanism

### 💳 Payment Processing
- Stripe integration for secure payments
- Multiple currency support (EUR, RON, USD, GBP)
- Webhook-based payment status updates
- Refund handling

### 📧 Invitation System
- Direct club invitations
- Email-based invitations for unregistered clubs
- Partner network invitations
- Past participant re-invitations
- Automated reminders

### 🔔 Notifications
- Real-time notification system
- Multiple notification types (tournament updates, registration status, etc.)

### 📁 File Management
- AWS S3-compatible file storage
- Secure presigned URLs
- File metadata tracking

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | NestJS | 11.0.1 |
| **Language** | TypeScript | 5.7.3 |
| **Runtime** | Node.js | ≥20.0.0 |
| **Database** | MySQL | 8.0 |
| **ORM** | TypeORM | 0.3.28 |
| **Cache** | Redis | 7 Alpine |
| **Auth** | JWT (passport-jwt) | 11.0.1 |
| **Payments** | Stripe | 20.0.0 |
| **File Storage** | AWS S3 SDK | 3.943.0 |
| **Documentation** | Swagger/OpenAPI | 11.2.3 |
| **Security** | Helmet | 8.1.0 |
| **Rate Limiting** | @nestjs/throttler | 6.5.0 |
| **Package Manager** | pnpm | Latest |

---

## System Requirements

### Minimum Requirements
- Node.js 20.x or later
- MySQL 8.0+
- Redis 7+
- 2GB RAM
- 10GB disk space

### Recommended for Production
- Node.js 22.x LTS
- MySQL 8.0 with replication
- Redis Cluster
- 8GB RAM
- 50GB SSD

---

## API Overview

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 9 | Registration, login, tokens, password management |
| Users | 8 | Profile management, preferences |
| Clubs | 11 | Club CRUD, verification, member management |
| Tournaments | 14 | Tournament lifecycle, settings, draw |
| Registrations | 11 | Club registration to tournaments |
| Groups | 6 | Group assignment and bracket management |
| Payments | 5 | Payment processing, status, refunds |
| Notifications | 5 | Notification management |
| Files | 6 | File upload, download, management |
| Admin | 11 | Administrative operations |
| Invitations | 12 | Tournament invitations system |
| **Total** | **~98** | - |

---

## Environment Modes

### Development
- `synchronize: true` - Auto-creates database tables
- Swagger documentation enabled at `/api/docs`
- Verbose logging
- No SSL required

### Production
- `synchronize: false` - Use migrations only
- Rate limiting enforced (100 req/min default)
- HTTPS required
- Helmet security headers enabled

---

## Project Structure

```
nest-app/
├── src/
│   ├── common/           # Shared utilities
│   │   ├── decorators/   # Custom decorators (@CurrentUser, @Roles)
│   │   ├── dto/          # Shared DTOs (PaginationDto)
│   │   ├── enums/        # Application enums
│   │   ├── filters/      # Exception filters
│   │   ├── guards/       # Auth guards
│   │   ├── interceptors/ # Response transformers
│   │   └── interfaces/   # Type definitions
│   ├── config/           # Configuration modules
│   └── modules/          # Feature modules
│       ├── admin/        # Admin operations
│       ├── auth/         # Authentication
│       ├── clubs/        # Club management
│       ├── files/        # File storage
│       ├── groups/       # Tournament groups
│       ├── invitations/  # Invitation system
│       ├── notifications/# User notifications
│       ├── payments/     # Stripe payments
│       ├── registrations/# Tournament registrations
│       ├── tournaments/  # Tournament management
│       ├── translations/ # i18n support
│       └── users/        # User management
├── test/                 # E2E tests
├── docs/                 # Documentation
├── docker-compose.yml    # Container orchestration
└── .env.example          # Environment template
```

---

## Quick Links

- [Getting Started Guide](./GETTING_STARTED.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Authentication & Security](./AUTHENTICATION_SECURITY.md)

---

## OpenAPI Specification

The OpenAPI/Swagger specification is available at runtime in development mode:

- **Swagger UI:** `http://localhost:3001/api/docs`
- **JSON Spec:** `http://localhost:3001/api/swagger-json`

---

## License

This project is proprietary software for the Football Tournament Platform.

---

## Contact

For technical support or inquiries, contact the development team.
