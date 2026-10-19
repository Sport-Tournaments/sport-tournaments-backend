# Leads CRM (admin)

A CRM for outreach to tournament organisers and clubs. All endpoints live under
`/api/v1/admin/leads` and require an **ADMIN** or **MANAGER** JWT
(`JwtAuthGuard` + `RolesGuard`). Managers can use every endpoint except
deleting a lead; they have no access to the rest of the admin API.

## Data model

### `leads`

| Field | Notes |
|-------|-------|
| `type` | `TOURNAMENT`, `CLUB` or `ORGANIZER`. |
| `tournamentId` / `clubId` / `organizerId` | Optional link to the platform record (at most one). Each is unique when set. |
| `name` (column `tournament_name`) | Display name. Denormalized details (`startDate`, `location`, `country`, `website`, `sourceUrl`, `organiser`) survive deletion of the linked record. |
| `contactName`, `contactEmail`, `contactPhone` | Contact details. |
| `status` | `NEW → CONTACTED → QUALIFIED → NEGOTIATION → WON / LOST`; `lostReason` when lost. |
| `priority` | `LOW`, `MEDIUM`, `HIGH`. |
| `tags` | Lower-cased text array. |
| `nextFollowUpAt`, `lastContactedAt` | Follow-up scheduling; `lastContactedAt` is stamped by logged calls/emails/meetings. |
| `notes` | Pinned internal summary (dated notes go on the timeline). |
| `assignedToId` | Owner — admin or manager accounts only. |
| `source` | `young-talents-group`, `euro-sportring`, `platform`, `manual`, `romania-research-2026`. |

### `lead_activities`

Timeline entries: `NOTE`, `CALL`, `EMAIL`, `MEETING` (logged by users; author or
admin can edit/delete) and `STATUS_CHANGE`, `ASSIGNMENT` (recorded
automatically). Logging a call/email/meeting moves a `NEW` lead to `CONTACTED`.

## Endpoints

| Method & path | Purpose |
|---------------|---------|
| `GET /admin/leads` | List: `status`, `type`, `priority`, `assignedToId` (or `me`), `unassigned`, `source`, `tag`, `country`, `followUp` (`overdue`/`today`/`week`/`none`), `search`, `sortBy`, `sortOrder`, pagination. |
| `GET /admin/leads/stats` | Counts per stage and type, overdue / due-today follow-ups, unassigned, assigned to me. |
| `GET /admin/leads/tags`, `GET /admin/leads/assignees` | Filter / form helpers. |
| `GET /admin/leads/clubs`, `GET /admin/leads/organizers` | Every club / tournament organizer with its lead, if any (`tracking=tracked|untracked`). |
| `POST /admin/leads/track/:type/:recordId` | Get or create the lead for a tournament, club or organizer. |
| `POST /admin/leads/import` | `{ types?: LeadType[] }` — create a lead for every record without one. Idempotent. |
| `GET /admin/leads/export` | Filtered leads as CSV (UTF-8 BOM, RFC-4180). |
| `PATCH /admin/leads/bulk` | `{ ids, status?, priority?, assignedToId? }`. |
| `GET/POST/PATCH /admin/leads/:id`, `DELETE` (admin only) | CRUD. |
| `GET/POST /admin/leads/:id/activities`, `PATCH/DELETE …/:activityId` | Timeline. |

## Initial data (migration `SeedCrmLeads1792400000000`)

Runs once on start-up (see `src/migrations`, executed by `MigrationsRunner`
after schema sync, under a Postgres advisory lock; failures are logged and
retried on the next start, never fatal). It:

1. Seeds 61 leads from a researched list of Romanian football tournaments,
   federations and county associations (AJF), `source = romania-research-2026`.
   Federations / associations become `ORGANIZER` leads (priority `LOW`),
   tournaments `TOURNAMENT` leads (`HIGH` when upcoming, else `MEDIUM`). The
   first email / source URL go into the contact fields; extra emails, sources,
   dates and age category go into `notes`. Tags: `romania`, the row type and
   its timing (`past` / `upcoming` / `recurring`).
2. Creates a lead for every existing tournament and organizer account that
   does not have one (same mapping as `POST /admin/leads/import`). The
   scrapers' system accounts (`import.*@turnee-sportive.ro`) are excluded.

Tournaments imported later can be pulled in with **Import from platform** in
the CRM (or `POST /admin/leads/import`). `down()` removes only the
research-list leads.
