# API Reference

Complete reference for all Football Tournament Platform API endpoints.

---

## Base URL

```
Development: http://localhost:3001/api
Production:  https://api.football-tournament.example.com/api
```

## Authentication

Most endpoints require JWT authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

---

## Authentication Endpoints

### POST /auth/register

Register a new user account.

**Public:** Yes

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "firstName": "John",
  "lastName": "Doe",
  "country": "Romania",
  "role": "ORGANIZER"  // Optional: USER, ORGANIZER, PARTICIPANT
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "ORGANIZER",
    "isVerified": false
  }
}
```

---

### POST /auth/login

Authenticate user and receive tokens.

**Public:** Yes

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response:** `200 OK`
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
      "firstName": "John",
      "lastName": "Doe",
      "role": "ORGANIZER"
    }
  }
}
```

---

### POST /auth/refresh-token

Refresh access token using refresh token.

**Public:** Yes

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

---

### POST /auth/verify-email

Verify email address with token.

**Public:** Yes

**Request Body:**
```json
{
  "token": "verification-token-from-email"
}
```

---

### POST /auth/forgot-password

Request password reset email.

**Public:** Yes

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

---

### POST /auth/reset-password

Reset password with token.

**Public:** Yes

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecureP@ss123"
}
```

---

### POST /auth/change-password

Change password for authenticated user.

**Requires:** Authentication

**Request Body:**
```json
{
  "currentPassword": "OldP@ss123",
  "newPassword": "NewSecureP@ss123"
}
```

---

### POST /auth/logout

Logout and invalidate refresh tokens.

**Requires:** Authentication

**Request Body:**
```json
{
  "refreshToken": "optional-specific-token"
}
```

---

### POST /auth/me

Get current user info from token.

**Requires:** Authentication

**Response:** `200 OK`
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "ORGANIZER"
}
```

---

## User Endpoints

### GET /users/profile

Get current user's full profile.

**Requires:** Authentication

---

### PATCH /users/profile

Update current user's profile.

**Requires:** Authentication

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+40712345678",
  "organizationName": "My Football Academy",
  "teamColors": {
    "primary": "#1a365d",
    "secondary": "#edf2f7",
    "accent": "#ed8936"
  }
}
```

---

### GET /users/:id

Get user by ID (Admin only).

**Requires:** ADMIN role

---

## Club Endpoints

### POST /clubs

Create a new club.

**Requires:** Authentication (ORGANIZER or PARTICIPANT)

**Request Body:**
```json
{
  "name": "FC Example Academy",
  "country": "Romania",
  "city": "Bucharest",
  "description": "Youth football academy",
  "contactEmail": "contact@fcexample.com",
  "contactPhone": "+40712345678",
  "website": "https://fcexample.com",
  "foundedYear": 2010
}
```

---

### GET /clubs

Get all clubs with pagination.

**Public:** Yes

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |
| country | string | Filter by country |
| search | string | Search by name |

---

### GET /clubs/:id

Get club by ID.

**Public:** Yes

---

### PATCH /clubs/:id

Update club.

**Requires:** Owner or ADMIN

---

### DELETE /clubs/:id

Delete club.

**Requires:** Owner or ADMIN

---

### GET /clubs/my-clubs

Get clubs owned by current user.

**Requires:** Authentication

---

## Tournament Endpoints

### POST /tournaments

Create a new tournament.

**Requires:** ORGANIZER role

**Request Body:**
```json
{
  "name": "Spring Cup 2025",
  "description": "Youth football tournament",
  "startDate": "2025-04-01",
  "endDate": "2025-04-03",
  "location": "Bucharest Sports Complex",
  "latitude": 44.4268,
  "longitude": 26.1025,
  "ageCategory": "U12",
  "level": "II",
  "maxTeams": 16,
  "participationFee": 250,
  "currency": "EUR",
  "registrationDeadline": "2025-03-15",
  "contactEmail": "tournament@example.com",
  "contactPhone": "+40712345678",
  "isPrivate": false,
  "tags": ["youth", "spring", "indoor"]
}
```

---

### GET /tournaments

Get all tournaments with filters.

**Public:** Yes

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| status | string | DRAFT, PUBLISHED, ONGOING, COMPLETED, CANCELLED |
| ageCategory | string | U8, U10, U12, U14, U16, U18, U21, SENIOR, VETERANS |
| level | string | I, II, III |
| country | string | Filter by country |
| startDate | date | Filter from date |
| endDate | date | Filter to date |
| search | string | Full-text search |

---

### GET /tournaments/featured

Get featured tournaments.

**Public:** Yes

---

### GET /tournaments/upcoming

Get upcoming tournaments.

**Public:** Yes

---

### GET /tournaments/my-tournaments

Get tournaments created by current user.

**Requires:** ORGANIZER role

---

### GET /tournaments/:id

Get tournament by ID.

**Public:** Yes

---

### PATCH /tournaments/:id

Update tournament.

**Requires:** Owner or ADMIN

---

### DELETE /tournaments/:id

Delete tournament.

**Requires:** Owner or ADMIN

---

### POST /tournaments/:id/publish

Publish tournament (make visible).

**Requires:** Owner (ORGANIZER)

---

### POST /tournaments/:id/cancel

Cancel tournament.

**Requires:** Owner or ADMIN

---

### POST /tournaments/:id/start

Start tournament (move to ONGOING).

**Requires:** Owner (ORGANIZER)

---

### POST /tournaments/:id/complete

Complete tournament.

**Requires:** Owner (ORGANIZER)

---

## Registration Endpoints

### POST /registrations

Register a club for a tournament.

**Requires:** Authentication

**Request Body:**
```json
{
  "tournamentId": "tournament-uuid",
  "clubId": "club-uuid",
  "numberOfPlayers": 15,
  "coachName": "John Smith",
  "coachPhone": "+40712345678",
  "emergencyContact": "+40712345679",
  "notes": "Special dietary requirements for 2 players"
}
```

---

### GET /registrations

Get registrations for current user's clubs.

**Requires:** Authentication

---

### GET /registrations/tournament/:tournamentId

Get all registrations for a tournament.

**Requires:** Tournament owner or ADMIN

---

### GET /registrations/:id

Get registration by ID.

**Requires:** Owner or tournament organizer

---

### PATCH /registrations/:id/approve

Approve registration.

**Requires:** Tournament owner or ADMIN

---

### PATCH /registrations/:id/reject

Reject registration.

**Requires:** Tournament owner or ADMIN

**Request Body:**
```json
{
  "reason": "Maximum capacity reached"
}
```

---

### POST /registrations/:id/withdraw

Withdraw registration.

**Requires:** Registration owner

---

## Group Endpoints

### POST /groups/tournament/:tournamentId/draw

Execute draw for tournament groups.

**Requires:** Tournament owner (ORGANIZER)

**Request Body:**
```json
{
  "groupCount": 4,
  "usePots": true,
  "seed": "optional-seed-string"
}
```

---

### GET /groups/tournament/:tournamentId

Get groups for a tournament.

**Public:** Yes (if tournament is published)

---

### PATCH /groups/:id

Update group (reassign teams).

**Requires:** Tournament owner or ADMIN

---

## Payment Endpoints

### POST /payments/create-intent

Create Stripe payment intent.

**Requires:** Authentication

**Request Body:**
```json
{
  "registrationId": "registration-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx",
    "amount": 25000,
    "currency": "eur"
  }
}
```

---

### POST /payments/webhook

Stripe webhook endpoint.

**Public:** Yes (verified by Stripe signature)

---

### GET /payments/:id

Get payment by ID.

**Requires:** Payment owner or tournament organizer

---

### POST /payments/:id/refund

Refund payment.

**Requires:** Tournament owner or ADMIN

---

## Invitation Endpoints

### POST /invitations

Create tournament invitation.

**Requires:** Tournament owner (ORGANIZER)

**Request Body:**
```json
{
  "tournamentId": "tournament-uuid",
  "clubId": "club-uuid",
  "type": "DIRECT",
  "message": "We'd love to have your team participate!",
  "expiresAt": "2025-03-01T00:00:00Z"
}
```

Or for email invitations:
```json
{
  "tournamentId": "tournament-uuid",
  "email": "club@example.com",
  "type": "EMAIL",
  "message": "You're invited to participate!"
}
```

---

### GET /invitations/tournament/:tournamentId

Get invitations for a tournament.

**Requires:** Tournament owner

---

### GET /invitations/my-invitations

Get invitations for current user's clubs.

**Requires:** Authentication

---

### POST /invitations/:id/accept

Accept invitation.

**Requires:** Invitation recipient

---

### POST /invitations/:id/decline

Decline invitation.

**Requires:** Invitation recipient

**Request Body:**
```json
{
  "message": "Unable to participate this season"
}
```

---

### POST /invitations/:id/resend

Resend invitation email.

**Requires:** Tournament owner

---

## Notification Endpoints

### GET /notifications

Get notifications for current user.

**Requires:** Authentication

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| unreadOnly | boolean | Filter unread only |

---

### PATCH /notifications/:id/read

Mark notification as read.

**Requires:** Notification owner

---

### POST /notifications/mark-all-read

Mark all notifications as read.

**Requires:** Authentication

---

### DELETE /notifications/:id

Delete notification.

**Requires:** Notification owner

---

## File Endpoints

### POST /files/upload

Upload a file.

**Requires:** Authentication

**Content-Type:** `multipart/form-data`

**Form Fields:**
| Field | Type | Description |
|-------|------|-------------|
| file | File | The file to upload |
| entityType | string | Optional: 'tournament', 'club', 'user' |
| entityId | string | Optional: Related entity ID |
| isPublic | boolean | Optional: Make file publicly accessible |

---

### GET /files/:id

Get file metadata.

**Requires:** File owner or ADMIN

---

### GET /files/:id/download

Get presigned download URL.

**Requires:** File owner or ADMIN

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://s3.amazonaws.com/...",
    "expiresIn": 3600
  }
}
```

---

### DELETE /files/:id

Delete file.

**Requires:** File owner or ADMIN

---

## Admin Endpoints

All admin endpoints require `ADMIN` role.

### GET /admin/users

Get all users with pagination.

### PATCH /admin/users/:id

Update any user.

### DELETE /admin/users/:id

Delete user.

### GET /admin/statistics

Get platform statistics.

### PATCH /admin/tournaments/:id

Admin update any tournament.

### POST /admin/clubs/:id/verify

Verify a club.

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "message": "Error description",
    "error": "Bad Request"
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/endpoint"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Standard endpoints | 100 requests/minute |
| Authentication endpoints | 10 requests/minute |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642234567
```

---

## Pagination

Paginated endpoints return:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15
  }
}
```
