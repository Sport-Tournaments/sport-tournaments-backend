# SEO Sitemap

The backend generates a [sitemaps.org](https://www.sitemaps.org/protocol.html)-compliant
sitemap so search engines (and Google Search Console) can discover every public
tournament page.

## Endpoints

All are served at the **host root** (excluded from the global `api` prefix and
API versioning) so crawlers find them at the conventional locations:

| Route | Description |
|-------|-------------|
| `GET /sitemap.xml` | **Sitemap index** — references the sub-sitemaps below. Submit this URL to Google Search Console. |
| `GET /sitemap-static.xml` | Static public pages (home, tournament listing). |
| `GET /sitemap-tournaments.xml` | Public tournaments. Paginated via `?page=N` (20,000 URLs per page). |
| `GET /robots.txt` | Allows all crawlers and advertises the sitemap index. |

Responses are `application/xml` (text for `robots.txt`), written to the raw
response so the global `TransformInterceptor` does not wrap them in a JSON
envelope. Each is cached for 1 hour (`robots.txt` for 1 day) via `Cache-Control`.

## What gets included

A tournament appears in `sitemap-tournaments.xml` only when it is publicly
visible:

- `status` is `PUBLISHED`, `ONGOING`, or `COMPLETED` (never `DRAFT`/`CANCELLED`)
- `isPublished = true`
- `isPrivate = false`
- it has a `urlSlug`

Per-URL hints:

- `lastmod` — the tournament's `updatedAt`
- `changefreq` — `daily` for ONGOING, otherwise `weekly`
- `priority` — `0.5` for COMPLETED, otherwise `0.8`

Entries are ordered by `updatedAt` (newest first).

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `SITEMAP_BASE_URL` | `FRONTEND_URL` | Public origin the sitemap `<loc>` URLs point at. Set to your real domain in production. |
| `SITEMAP_TOURNAMENT_PATH` | `/tournaments` | Path prefix for a public tournament page: `${SITEMAP_BASE_URL}${SITEMAP_TOURNAMENT_PATH}/${slug}`. |

If your public tournament pages live at, say, `https://tournamente.ro/t/<slug>`,
set `SITEMAP_TOURNAMENT_PATH=/t`.

## Submitting to Google Search Console

1. Verify your domain in [Search Console](https://search.google.com/search-console).
2. Under **Sitemaps**, add `sitemap.xml`.
3. Google reads the index and crawls each sub-sitemap automatically.

`robots.txt` also lists the sitemap, so most crawlers discover it without manual
submission.
