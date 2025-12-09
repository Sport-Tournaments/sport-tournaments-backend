# Database Schema

Complete database schema documentation for the Football Tournament Platform.

---

## Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    Users    │───────│   Tournaments    │───────│   Groups    │
└─────────────┘       └──────────────────┘       └─────────────┘
      │                       │                        
      │                       │                        
      ▼                       ▼                        
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    Clubs    │───────│  Registrations   │───────│  Payments   │
└─────────────┘       └──────────────────┘       └─────────────┘
      │                       
      │                       
      ▼                       
┌─────────────────────┐    ┌─────────────────┐    ┌─────────────┐
│ TournamentInvitations│    │  Notifications  │    │    Files    │
└─────────────────────┘    └─────────────────┘    └─────────────┘
```

---

## Tables

### users

User accounts and profiles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address |
| password | VARCHAR(255) | NULL | Hashed password (nullable for OAuth) |
| first_name | VARCHAR(255) | NOT NULL | First name |
| last_name | VARCHAR(255) | NOT NULL | Last name |
| phone | VARCHAR(50) | NULL | Phone number |
| country | VARCHAR(100) | NOT NULL, INDEX | Country |
| role | ENUM | NOT NULL, DEFAULT 'USER' | USER, ORGANIZER, PARTICIPANT, ADMIN |
| is_active | BOOLEAN | DEFAULT true | Account active status |
| is_verified | BOOLEAN | DEFAULT false | Email verified status |
| email_verification_token | VARCHAR(255) | NULL | Email verification token |
| password_reset_token | VARCHAR(255) | NULL | Password reset token |
| password_reset_expires | DATETIME | NULL | Token expiration |
| profile_image_url | VARCHAR(500) | NULL | Profile image URL |
| team_colors | JSON | NULL | Dashboard theme colors |
| organization_name | VARCHAR(255) | NULL | Organizer's organization name |
| organization_logo | VARCHAR(500) | NULL | Organization logo URL |
| default_location | JSON | NULL | Default venue location |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `UNIQUE` on `email`
- `INDEX` on `country`

---

### clubs

Football clubs/teams.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| name | VARCHAR(255) | UNIQUE, NOT NULL | Club name |
| organizer_id | UUID | FK → users.id, NOT NULL | Owner user ID |
| country | VARCHAR(100) | NOT NULL, INDEX | Country |
| city | VARCHAR(100) | NOT NULL | City |
| latitude | DECIMAL(10,7) | NULL | GPS latitude |
| longitude | DECIMAL(10,7) | NULL | GPS longitude |
| description | TEXT | NULL | Club description |
| logo | VARCHAR(500) | NULL | Logo URL |
| founded_year | INT | NULL | Year founded |
| is_verified | BOOLEAN | DEFAULT false | Verified by admin |
| is_premium | BOOLEAN | DEFAULT false | Premium tier |
| website | VARCHAR(500) | NULL | Website URL |
| contact_email | VARCHAR(255) | NULL | Contact email |
| contact_phone | VARCHAR(50) | NULL | Contact phone |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `UNIQUE` on `name`
- `INDEX` on `country`
- `FULLTEXT` on `name` (IDX_clubs_name_fulltext)

**Foreign Keys:**
- `organizer_id` → `users.id` ON DELETE CASCADE

---

### tournaments

Tournament events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| name | VARCHAR(255) | NOT NULL | Tournament name |
| organizer_id | UUID | FK → users.id, NOT NULL | Creator user ID |
| description | TEXT | NULL | Tournament description |
| status | ENUM | NOT NULL, INDEX | DRAFT, PUBLISHED, ONGOING, COMPLETED, CANCELLED |
| start_date | DATE | NOT NULL, INDEX | Start date |
| end_date | DATE | NOT NULL | End date |
| location | VARCHAR(255) | NOT NULL | Venue/location name |
| latitude | DECIMAL(10,7) | NULL | GPS latitude |
| longitude | DECIMAL(10,7) | NULL | GPS longitude |
| age_category | ENUM | NOT NULL, INDEX | U8, U10, U12, U14, U16, U18, U21, SENIOR, VETERANS |
| level | ENUM | DEFAULT 'II' | I, II, III |
| game_system | VARCHAR(100) | NULL | Game format description |
| number_of_matches | INT | NULL | Expected match count |
| max_teams | INT | NOT NULL | Maximum team capacity |
| current_teams | INT | DEFAULT 0 | Current registrations |
| regulations_document | VARCHAR(500) | NULL | Regulations file URL |
| regulations_download_count | INT | DEFAULT 0 | Download counter |
| currency | ENUM | DEFAULT 'EUR' | EUR, RON, USD, GBP |
| participation_fee | DECIMAL(10,2) | DEFAULT 0 | Registration fee |
| is_premium | BOOLEAN | DEFAULT false | Premium listing |
| is_published | BOOLEAN | DEFAULT false | Visibility flag |
| is_featured | BOOLEAN | DEFAULT false | Featured on homepage |
| tags | JSON | NULL | Searchable tags |
| registration_deadline | DATE | NULL | Registration cutoff |
| contact_email | VARCHAR(255) | NULL | Contact email |
| contact_phone | VARCHAR(50) | NULL | Contact phone |
| draw_seed | VARCHAR(255) | NULL | Random seed for draw |
| draw_completed | BOOLEAN | DEFAULT false | Draw executed flag |
| is_private | BOOLEAN | DEFAULT false, INDEX | Invitation-only |
| visibility_settings | JSON | NULL | Privacy configuration |
| bracket_data | JSON | NULL | Tournament bracket structure |
| regulations_type | ENUM | NULL | UPLOADED, GENERATED |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `INDEX` on `status`, `start_date`, `age_category`, `is_private`
- `FULLTEXT` on `name`, `description`

**Foreign Keys:**
- `organizer_id` → `users.id` ON DELETE CASCADE

---

### registrations

Club registrations to tournaments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tournament_id | UUID | FK → tournaments.id, NOT NULL | Tournament ID |
| club_id | UUID | FK → clubs.id, NOT NULL | Club ID |
| status | ENUM | DEFAULT 'PENDING' | PENDING, APPROVED, REJECTED, WITHDRAWN |
| group_assignment | VARCHAR(10) | NULL | Assigned group letter |
| number_of_players | INT | NULL | Player count |
| coach_name | VARCHAR(255) | NULL | Coach name |
| coach_phone | VARCHAR(50) | NULL | Coach phone |
| emergency_contact | VARCHAR(50) | NULL | Emergency contact |
| notes | TEXT | NULL | Additional notes |
| payment_status | ENUM | DEFAULT 'PENDING' | PENDING, COMPLETED, FAILED, REFUNDED |
| payment_id | UUID | NULL | Associated payment ID |
| registration_date | DATETIME | NOT NULL | Registration timestamp |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `UNIQUE` on (`tournament_id`, `club_id`)
- `INDEX` on `tournament_id`, `club_id`

**Foreign Keys:**
- `tournament_id` → `tournaments.id` ON DELETE CASCADE
- `club_id` → `clubs.id` ON DELETE CASCADE

---

### payments

Payment transactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| registration_id | UUID | FK → registrations.id, UNIQUE | Registration ID |
| user_id | UUID | FK → users.id, NULL | Paying user ID |
| tournament_id | UUID | FK → tournaments.id, NULL | Tournament ID |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount |
| currency | ENUM | DEFAULT 'EUR' | EUR, RON, USD, GBP |
| status | ENUM | DEFAULT 'PENDING', INDEX | PENDING, COMPLETED, FAILED, REFUNDED |
| stripe_payment_intent_id | VARCHAR(255) | NULL, INDEX | Stripe PI ID |
| stripe_customer_id | VARCHAR(255) | NULL | Stripe customer ID |
| stripe_charge_id | VARCHAR(255) | NULL | Stripe charge ID |
| stripe_fee | DECIMAL(10,2) | NULL | Stripe processing fee |
| refund_id | VARCHAR(255) | NULL | Stripe refund ID |
| refund_amount | DECIMAL(10,2) | NULL | Refunded amount |
| refund_reason | TEXT | NULL | Refund reason |
| failure_reason | TEXT | NULL | Failure reason |
| metadata | JSON | NULL | Additional metadata |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `UNIQUE` on `registration_id`
- `INDEX` on `status`, `stripe_payment_intent_id`, `user_id`, `tournament_id`

**Foreign Keys:**
- `registration_id` → `registrations.id` ON DELETE CASCADE
- `user_id` → `users.id` ON DELETE SET NULL
- `tournament_id` → `tournaments.id` ON DELETE SET NULL

---

### groups

Tournament group assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tournament_id | UUID | FK → tournaments.id, NOT NULL | Tournament ID |
| group_letter | VARCHAR(5) | NOT NULL | Group identifier (A, B, C...) |
| teams | JSON | NOT NULL | Array of registration IDs |
| group_order | INT | DEFAULT 0 | Display order |
| created_at | DATETIME | NOT NULL | Creation timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `INDEX` on `tournament_id`

**Foreign Keys:**
- `tournament_id` → `tournaments.id` ON DELETE CASCADE

---

### tournament_invitations

Invitations to participate in tournaments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tournament_id | UUID | FK → tournaments.id, NOT NULL | Tournament ID |
| club_id | UUID | FK → clubs.id, NULL | Invited club ID |
| email | VARCHAR(255) | NULL | Email for non-registered clubs |
| type | ENUM | DEFAULT 'DIRECT' | DIRECT, EMAIL, PARTNER, PAST_PARTICIPANT |
| status | ENUM | DEFAULT 'PENDING' | PENDING, ACCEPTED, DECLINED, EXPIRED |
| invitation_token | VARCHAR(255) | UNIQUE, NOT NULL | Unique token for email links |
| message | TEXT | NULL | Custom message |
| expires_at | DATETIME | NULL | Expiration date |
| responded_at | DATETIME | NULL | Response timestamp |
| response_message | TEXT | NULL | Decline reason |
| email_sent | BOOLEAN | DEFAULT false | Email sent flag |
| email_sent_at | DATETIME | NULL | Email sent timestamp |
| reminder_sent | BOOLEAN | DEFAULT false | Reminder sent flag |
| reminder_sent_at | DATETIME | NULL | Reminder timestamp |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `UNIQUE` on (`tournament_id`, `club_id`)
- `UNIQUE` on (`tournament_id`, `email`)
- `UNIQUE` on `invitation_token`
- `INDEX` on `tournament_id`, `club_id`, `email`

**Foreign Keys:**
- `tournament_id` → `tournaments.id` ON DELETE CASCADE
- `club_id` → `clubs.id` ON DELETE CASCADE

---

### notifications

User notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK → users.id, NOT NULL | Recipient user ID |
| type | ENUM | NOT NULL, INDEX | Notification type |
| title | VARCHAR(255) | NOT NULL | Notification title |
| message | TEXT | NOT NULL | Notification body |
| related_tournament_id | UUID | NULL | Related tournament |
| related_registration_id | UUID | NULL | Related registration |
| is_read | BOOLEAN | DEFAULT false | Read status |
| send_email_notification | BOOLEAN | DEFAULT true | Send email flag |
| email_sent | BOOLEAN | DEFAULT false | Email sent status |
| metadata | JSON | NULL | Additional data |
| created_at | DATETIME | NOT NULL | Creation timestamp |

**Notification Types:**
- REGISTRATION_CONFIRMATION
- REGISTRATION_APPROVED
- REGISTRATION_REJECTED
- TOURNAMENT_PUBLISHED
- TOURNAMENT_CANCELLED
- TOURNAMENT_UPDATE
- GROUP_DRAW
- PAYMENT_REMINDER
- PAYMENT_COMPLETED
- PAYMENT_FAILED
- NEW_TOURNAMENT_MATCH
- SYSTEM

**Indexes:**
- `PRIMARY` on `id`
- `INDEX` on `user_id`, `type`

**Foreign Keys:**
- `user_id` → `users.id` ON DELETE CASCADE

---

### files

File storage metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| original_name | VARCHAR(255) | NOT NULL | Original filename |
| filename | VARCHAR(255) | NOT NULL | Stored filename |
| mime_type | VARCHAR(100) | NOT NULL | MIME type |
| size | INT | NOT NULL | File size in bytes |
| s3_key | VARCHAR(500) | NOT NULL, INDEX | S3 object key |
| s3_url | VARCHAR(500) | NOT NULL | S3 URL |
| uploaded_by | UUID | NOT NULL, INDEX | Uploader user ID |
| entity_type | VARCHAR(50) | NULL | Related entity type |
| entity_id | UUID | NULL | Related entity ID |
| is_public | BOOLEAN | DEFAULT false | Public access flag |
| created_at | DATETIME | NOT NULL | Creation timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `INDEX` on `s3_key`, `uploaded_by`

---

### refresh_tokens

JWT refresh tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK → users.id, NOT NULL | Token owner |
| token_hash | VARCHAR(255) | NOT NULL | Hashed token |
| user_agent | VARCHAR(255) | NULL | Browser/client info |
| ip_address | VARCHAR(45) | NULL | Client IP |
| expires_at | DATETIME | NOT NULL | Token expiration |
| is_revoked | BOOLEAN | DEFAULT false | Revocation status |
| created_at | DATETIME | NOT NULL | Creation timestamp |

**Indexes:**
- `PRIMARY` on `id`
- `INDEX` on `user_id`, `token_hash`

**Foreign Keys:**
- `user_id` → `users.id` ON DELETE CASCADE

---

## Enums

### UserRole
```sql
ENUM('ADMIN', 'ORGANIZER', 'PARTICIPANT', 'USER')
```

### TournamentStatus
```sql
ENUM('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED')
```

### TournamentLevel
```sql
ENUM('I', 'II', 'III')
```

### AgeCategory
```sql
ENUM('U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'U21', 'SENIOR', 'VETERANS')
```

### RegistrationStatus
```sql
ENUM('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')
```

### PaymentStatus
```sql
ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')
```

### Currency
```sql
ENUM('EUR', 'RON', 'USD', 'GBP')
```

### NotificationType
```sql
ENUM(
  'REGISTRATION_CONFIRMATION',
  'REGISTRATION_APPROVED',
  'REGISTRATION_REJECTED',
  'TOURNAMENT_PUBLISHED',
  'TOURNAMENT_CANCELLED',
  'TOURNAMENT_UPDATE',
  'GROUP_DRAW',
  'PAYMENT_REMINDER',
  'PAYMENT_COMPLETED',
  'PAYMENT_FAILED',
  'NEW_TOURNAMENT_MATCH',
  'SYSTEM'
)
```

### InvitationStatus
```sql
ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')
```

### InvitationType
```sql
ENUM('DIRECT', 'EMAIL', 'PARTNER', 'PAST_PARTICIPANT')
```

---

## Database Configuration

### Connection Settings

```typescript
{
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
}
```

### Character Set

- **Charset:** `utf8mb4` (supports full Unicode including emojis)
- **Collation:** `utf8mb4_unicode_ci` (case-insensitive Unicode sorting)

---

## Migrations

In development, TypeORM auto-synchronizes schema (`synchronize: true`).

For production, disable synchronization and use migrations:

```bash
# Generate migration from entity changes
npx typeorm migration:generate -n MigrationName

# Run pending migrations
npx typeorm migration:run

# Revert last migration
npx typeorm migration:revert
```
