# Authentication & Security

Comprehensive guide to authentication, authorization, and security features in the Football Tournament Platform.

---

## Authentication Flow

### JWT-Based Authentication

The platform uses JSON Web Tokens (JWT) for stateless authentication.

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│  Client  │────▶│  Login   │────▶│ Access Token │
└──────────┘     └──────────┘     │ + Refresh    │
                                  └──────────────┘
                                         │
                                         ▼
┌──────────┐     ┌──────────┐     ┌──────────────┐
│ Protected│◀────│  Guard   │◀────│ Verify Token │
│ Resource │     └──────────┘     └──────────────┘
└──────────┘
```

### Token Types

| Token | Purpose | Expiration | Storage |
|-------|---------|------------|---------|
| Access Token | API authentication | 15 minutes | Memory/localStorage |
| Refresh Token | Get new access token | 7 days | HttpOnly cookie (recommended) |

---

## Authentication Endpoints

### Registration

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "firstName": "John",
  "lastName": "Doe",
  "country": "Romania",
  "role": "ORGANIZER"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "ORGANIZER"
    }
  }
}
```

### Token Refresh

```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "optional-to-revoke-specific-token"
}
```

---

## Token Structure

### Access Token Payload (JWT)

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "ORGANIZER",
  "iat": 1642234567,
  "exp": 1642235467
}
```

### Refresh Token

Refresh tokens are:
- Stored hashed in database
- Associated with user agent and IP
- Revocable individually or all at once

---

## Using Authentication in Requests

### Include Token in Header

```http
GET /api/tournaments/my-tournaments
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Handle Token Expiration

When access token expires (401 response):

1. Call `/api/auth/refresh-token` with refresh token
2. Receive new access and refresh tokens
3. Retry original request with new access token

---

## Authorization (Role-Based Access Control)

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **ADMIN** | Platform administrator | Full access to all resources |
| **ORGANIZER** | Tournament organizer | Create/manage tournaments, manage registrations |
| **PARTICIPANT** | Club manager | Manage clubs, register for tournaments |
| **USER** | Basic user | View public content, update profile |

### Role Hierarchy

```
ADMIN
  └── ORGANIZER
        └── PARTICIPANT
              └── USER
```

### Permission Matrix

| Action | ADMIN | ORGANIZER | PARTICIPANT | USER |
|--------|-------|-----------|-------------|------|
| Create Tournament | ✅ | ✅ | ❌ | ❌ |
| Update Own Tournament | ✅ | ✅ | ❌ | ❌ |
| Update Any Tournament | ✅ | ❌ | ❌ | ❌ |
| Delete Tournament | ✅ | ✅ (own) | ❌ | ❌ |
| Create Club | ✅ | ✅ | ✅ | ❌ |
| Register for Tournament | ✅ | ✅ | ✅ | ❌ |
| Approve Registrations | ✅ | ✅ (own tournaments) | ❌ | ❌ |
| View Admin Panel | ✅ | ❌ | ❌ | ❌ |
| Verify Clubs | ✅ | ❌ | ❌ | ❌ |

---

## Guards and Decorators

### Guards

```typescript
// JWT Authentication Guard
@UseGuards(JwtAuthGuard)

// Role-based Authorization Guard
@UseGuards(JwtAuthGuard, RolesGuard)
```

### Decorators

```typescript
// Get current user from JWT payload
@CurrentUser() user: JwtPayload

// Require specific roles
@Roles(UserRole.ORGANIZER)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER)

// Mark endpoint as public (no auth required)
@Public()
```

### Example Controller

```typescript
@Controller('tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TournamentsController {
  
  // Public endpoint - no authentication required
  @Get()
  @Public()
  findAll() { ... }
  
  // Requires ORGANIZER role
  @Post()
  @Roles(UserRole.ORGANIZER)
  create(@CurrentUser() user: JwtPayload) { ... }
  
  // Requires ADMIN role
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  delete(@Param('id') id: string) { ... }
}
```

---

## Security Headers

### Helmet Configuration

The platform uses [Helmet](https://helmetjs.github.io/) for security headers:

```typescript
app.use(helmet());
```

**Headers Applied:**
- `Content-Security-Policy`
- `X-DNS-Prefetch-Control`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection`
- `Strict-Transport-Security` (HTTPS)
- `X-Permitted-Cross-Domain-Policies`

---

## CORS Configuration

```typescript
app.enableCors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  credentials: true,
});
```

---

## Rate Limiting

### Configuration

```typescript
@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // Time window in seconds
      limit: 100,   // Max requests per window
    }),
  ],
})
```

### Endpoint-Specific Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Standard API | 100 requests | 1 minute |
| Authentication | 10 requests | 1 minute |
| File Upload | 20 requests | 1 minute |

### Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642234567
```

### Rate Limit Exceeded

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "ThrottlerException"
}
```

---

## Password Security

### Hashing

Passwords are hashed using **bcrypt** with a cost factor of 10:

```typescript
import * as bcrypt from 'bcrypt';

const saltRounds = 10;
const hashedPassword = await bcrypt.hash(password, saltRounds);
```

### Verification

```typescript
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

### Password Reset Flow

1. User requests reset → `/api/auth/forgot-password`
2. System generates secure token
3. Email sent with reset link
4. User submits new password with token → `/api/auth/reset-password`
5. Token invalidated after use

---

## Email Verification

### Flow

1. User registers → Account created with `isVerified: false`
2. Verification email sent with unique token
3. User clicks link → `/api/auth/verify-email`
4. Account marked as `isVerified: true`

### Token Security

- Tokens are single-use
- Tokens expire after 24 hours
- Stored securely in database

---

## Session Management

### Refresh Token Storage

Refresh tokens are stored in the `refresh_tokens` table:

```typescript
{
  id: 'uuid',
  userId: 'user-uuid',
  tokenHash: 'hashed-token',
  userAgent: 'Mozilla/5.0...',
  ipAddress: '192.168.1.1',
  expiresAt: '2025-01-22T00:00:00Z',
  isRevoked: false,
  createdAt: '2025-01-15T00:00:00Z'
}
```

### Multi-Device Support

Users can be logged in on multiple devices simultaneously. Each device has its own refresh token.

### Logout Options

- **Single device:** Revoke specific refresh token
- **All devices:** Revoke all user's refresh tokens

---

## API Key Authentication (Future)

For server-to-server communication, API keys will be supported:

```http
GET /api/tournaments
X-API-Key: your-api-key
```

---

## Security Best Practices

### For API Consumers

1. **Store tokens securely**
   - Access tokens: Memory only (not localStorage)
   - Refresh tokens: HttpOnly cookies

2. **Handle token expiration gracefully**
   - Implement automatic token refresh
   - Queue failed requests during refresh

3. **Use HTTPS**
   - Never transmit tokens over HTTP

4. **Validate redirect URLs**
   - Prevent open redirects

### For Developers

1. **Validate all inputs**
   - Use class-validator decorators
   - Sanitize user input

2. **Use parameterized queries**
   - TypeORM handles this automatically

3. **Log security events**
   - Failed login attempts
   - Password changes
   - Token revocations

4. **Keep dependencies updated**
   - Regular security audits
   - `npm audit` / `pnpm audit`

---

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-at-least-32-characters
JWT_REFRESH_EXPIRES_IN=7d

# Security Settings
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

**Important:** Never commit secrets to version control. Use environment variables or secret management services.
