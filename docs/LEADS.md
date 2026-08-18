# Leads CRM (admin)

A lightweight CRM for tracking tournament organisers as sales/outreach leads.
All endpoints live under `/api/v1/admin/leads` and require an **ADMIN** JWT
(`JwtAuthGuard` + `RolesGuard`).

## Data model (`leads` table)

| Field | Notes |
|-------|-------|
| `tournamentId` | Optional link to a tournament. Unique when set (one lead per tournament); manual leads have `null`. |
| `tournamentName`, `startDate`, `location`, `sourceUrl`, `organiser` | Denormalized tournament details (kept even if the tournament is deleted). |
| `contactName`, `contactEmail`, `contactPhone` | Filled in by the sales team. |
| `status` | Pipeline stage: `NEW → CONTACTED → QUALIFIED → WON / LOST` (default `NEW`). |
| `notes` | Free text. |
| `assignedToId` | Optional user the lead is assigned to. |
| `source` | Origin: `young-talents-group`, `euro-sportring`, `platform`, or `manual`. |

## Endpoints

| Method & path | Purpose |
|---------------|---------|
| `GET /admin/leads` | List with pagination + filters: `status`, `source`, `assignedToId`, `search` (matches tournament name, organiser, contact name/email). |
| `GET /admin/leads/stats` | Total + count per pipeline stage (CRM dashboard). |
| `GET /admin/leads/export` | Download the **filtered** leads as CSV (same query params as the list). Excel-friendly (UTF-8 BOM, RFC-4180 quoting). |
| `POST /admin/leads/import` | Create a lead for every tournament that doesn't have one yet. **Idempotent** — existing leads keep their CRM state. |
| `GET /admin/leads/:id` | Get one lead (with `assignedTo` and `tournament`). |
| `POST /admin/leads` | Create a lead manually. |
| `PATCH /admin/leads/:id` | Update status, notes, contact details, or assignee. |
| `DELETE /admin/leads/:id` | Delete a lead. |

## Populating from tournaments

Call `POST /admin/leads/import` once to seed a lead per tournament (Young
Talents + Euro-Sportring + anything else in the DB). It pulls the tournament
name, start date, location, and the source URL (parsed from the tournament
description the importers embed as `Source: <url>`). Contact email/phone are
left blank for the sales team to fill in.

Because the import is idempotent, you can re-run it after new tournaments are
imported (e.g. after a deploy) to pick up the new ones without disturbing
leads you've already worked.

## CSV export

`GET /admin/leads/export` returns the columns: Tournament Name, Start Date,
Status, Organiser, Contact Name, Contact Email, Contact Phone, Location,
Source URL, Assigned To, Notes, Source — respecting any filter query params.
This covers pasting into a leads form / mail-merge.
