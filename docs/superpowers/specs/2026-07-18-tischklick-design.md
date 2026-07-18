# TischKlick — Design Spec

**Date:** 2026-07-18
**Status:** Approved pending user review

## What it is

TischKlick is a web product for German cafés and restaurants. Each venue places
NFC cards on its tables. A guest taps a card with their phone, which opens a
venue-specific mobile web page (no app install). Guests who rate their visit
4–5 stars are directed to the venue's Google review page; guests who rate
1–3 stars are kept on-site and asked for private feedback that only the venue
owner sees.

## Decisions made during brainstorming

| Decision | Choice |
|---|---|
| MVP scope | Functional MVP, **no billing** — venues onboarded manually; subscriptions later |
| Google listing connection | Owner searches their venue name → Google **Places API** → store Place ID; manual review-link paste as fallback |
| Rating flow | **Hard gating** as specified: 1–3 stars → private feedback only; 4–5 stars → Google review interstitial. (Risk flagged and accepted: this violates Google's review-gating policy and carries Abmahnung risk in Germany.) |
| Language | Guest **and** owner UI in German, via `next-intl` scaffolding (single `de` locale file; more languages later are a file, not a refactor) |
| Multi-venue | Schema supports many venues per owner from day one; UI ships with a simple venue switcher |

## Stack

- **Next.js** (App Router) on **Vercel**, region `fra1`
- **Supabase** (Frankfurt, `eu-central-1`): Postgres, Auth (email + password), Storage (logo uploads)
- **Tailwind CSS**; `next-intl` for i18n
- Writes via **Server Actions**; no separate API layer
- **Row-level security** on all tables: an owner's session can only touch their own venues' data
- Guest pages are React Server Components working with plain links/forms — near-zero client JavaScript, fast on mobile data

## Data model (Postgres)

```
owners      — id (= auth.users id), email, created_at
venues      — id, owner_id → owners, name, slug, google_place_id,
              google_review_url, logo_url (optional), created_at
tables      — id, venue_id → venues, label ("Tisch 1"),
              code (short unique, 7-char base62 — the NFC payload), created_at
tap_events  — id, table_id → tables, venue_id, created_at,
              outcome ('opened' | 'google_redirect' | 'private_feedback')
feedback    — id, venue_id, table_id, rating (1–5),
              categories (text[]: 'Essen', 'Service', 'Wartezeit', 'Sauberkeit', 'Preis'),
              comment (optional), contact (optional, guest-volunteered),
              created_at, read_at
```

Model notes:

- `tap_events` stores **no IP, no user agent, no fingerprint** — only "a tap
  happened at this table at this time" and what it led to. This is what makes
  the guest side genuinely anonymous and cookie-banner-free.
- A tap event is inserted when the guest page loads (`opened`); the row's
  `outcome` is updated on Google redirect or feedback submit. Rows left at
  `opened` measure bounce.
- `tables.code` goes on the NFC card as `tischklick.de/f/<code>` — short enough
  for any NTAG213 tag.

## Guest flow (all German)

1. **`GET /f/[code]`** — server looks up table + venue, inserts a `tap_events`
   row, renders the rating screen: venue name/logo, „Wie war Ihr Besuch bei
   uns?", five large tap-target stars. Unknown/deleted code → friendly generic
   page („Dieser Link ist leider nicht mehr aktiv"), no code enumeration.
2. **4–5 stars** → interstitial „Danke! Würden Sie uns auf Google bewerten?"
   with one primary button that records `google_redirect` and sends the guest
   to `https://search.google.com/local/writereview?placeid=<id>`. An
   interstitial rather than a silent redirect: silent redirects feel broken on
   slow connections and give no moment to record the outcome.
3. **1–3 stars** → private feedback form: multi-select category chips (Essen,
   Service, Wartezeit, Sauberkeit, Preis), optional free text („Was können wir
   besser machen?"), optional contact field clearly labeled voluntary („Nur
   falls Sie eine Antwort möchten"). Submit records `private_feedback`.
4. **Confirmation** — „Vielen Dank für Ihr Feedback!" with venue name. No
   further links.

The entire flow works without client-side JavaScript (forms + redirects).

## Owner dashboard (German, behind Supabase Auth)

- **Onboarding:** sign up → „Venue anlegen": name → Google listing search
  (name/city → Places API → pick result → store Place ID) → „Testlink" to
  verify the review page opens. Places API failure → retry or paste review
  link manually.
- **Feedback inbox** (default view): newest first, unread badge, entries show
  stars, categories, comment, table, timestamp, contact if volunteered.
  Mark-as-read on open. Contact details deletable.
- **Tische & Links:** add tables; each gets code + full URL with copy button
  and a QR code (for card programming and printed fallback).
- **Statistik:** taps, Google-Weiterleitungen, privates Feedback, conversion
  („X % der Taps führten zu einer Aktion"), simple 30-day view. Numbers first,
  charts later.
- **Einstellungen:** venue name, logo upload, Google listing re-link, venue
  switcher (dropdown; invisible in practice for single-venue owners).

## Privacy & legal (GDPR)

- Guest side: **no cookies**, no IP/UA storage → no consent banner. Footer
  links to `/datenschutz` and `/impressum` on every guest page.
- Owner side: strictly-necessary Supabase auth cookies only → no banner.
- `/datenschutz` and `/impressum` ship as editable German templates with
  clearly marked placeholders for the operator's identity details (legal
  finalization is the operator's responsibility).
- All data hosted in the EU (Vercel fra1, Supabase Frankfurt).

## Error handling

- Invalid table code → generic friendly German page.
- Failed feedback submit → form re-renders with values preserved + German
  error message.
- Places API errors during onboarding → retry, or manual review-link paste.

## Testing

- Unit: rating-branch logic, table-code generation.
- Integration: guest flow end-to-end (tap → rate → both branches); **RLS
  policies** (owner A cannot read owner B's feedback).
- E2E: Playwright smoke test of the full guest path on a mobile viewport.

## Out of scope for this MVP

Billing/subscriptions, reading or replying to Google reviews, team member
invites, email notifications on new feedback, analytics charts, multi-language
guest pages, native NFC card provisioning tooling.
