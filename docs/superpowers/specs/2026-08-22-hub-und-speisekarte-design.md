# Link-Seite (Hub) & gehostete Speisekarte — Design

Datum: 2026-08-22
Status: approved (Abschnitt 1), Rest zur Review

## 1. Ziel

Eine Taplink-artige **Link-Seite** als Landepunkt der NFC-Karte: Logo, Name,
und eine konfigurierbare, sortierbare Liste von Buttons (Speisekarte,
Bewerten, Instagram, WhatsApp, …). Der Speisekarten-Button öffnet eine
**in TischKlick gehostete** Speisekarte mit Kategorien, Preisen, Fotos,
Diät-Tags und deutscher Allergen-/Zusatzstoff-Kennzeichnung.

Der bestehende Bewertungs-Funnel (1–3★ privat, 4–5★ Google) bleibt
unverändert und ist von der Link-Seite aus erreichbar.

## 2. Entscheidungen

| Frage | Entscheidung |
|---|---|
| NFC-Ziel | Bleibt `/f/{code}`. Pro Venue schaltet `hub_enabled` zwischen Hub und heutigem Sternen-Start um. Default `false` → keine Verhaltensänderung für bestehende Venues. |
| Speisekarte | Gehostet in TischKlick (Kategorien + Items), kein PDF, kein externer Link. |
| Buttons | `menu` und `review` sind eingebaute, umsortierbare, abschaltbare aber nicht löschbare Blöcke. Alles andere ist eine freie Liste aus `{icon, label, url}`. |
| Item-Felder | Name, Beschreibung, Preis, ausverkauft, Diät-Tags, Allergene, Zusatzstoffe, Foto. |
| Ausgehende Links | Direkt (`<a rel="noopener noreferrer">`), kein Redirector. Validierung beim Speichern. |
| Klick-Zählung | **Keine** Pro-Link-Zählung (folgt aus „kein Redirector"). Speisekarten-Aufrufe werden gezählt. |
| Menü-Tracking | `tap_events.menu_viewed_at timestamptz` statt eines neuen `tap_outcome`-Werts — siehe 3.2. |

### Bewusst nicht im Scope
Item-Varianten (0,3 l / 0,5 l → zwei Items anlegen), mehrsprachige Karten
(App ist deutschsprachig), Mittagskarte/Zeitsteuerung, Bestellfunktion,
Pro-Link-Klickzahlen, venue-weite Karten-URL ohne Tischcode.

## 3. Datenmodell

### 3.1 Neue Tabellen und Spalten

```sql
alter table public.venues
  add column hub_enabled boolean not null default false,
  add column hub_tagline text;

create type public.link_kind as enum ('menu', 'review', 'custom');

create table public.venue_links (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind public.link_kind not null,
  label text not null,
  icon text,
  url text,
  enabled boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  -- Invariante in der DB: nur custom-Blöcke haben eine URL,
  -- menu/review lösen intern auf und dürfen keine tragen.
  constraint venue_links_url_matches_kind
    check ((kind = 'custom') = (url is not null))
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  -- Zielspalten für den zusammengesetzten FK aus menu_items (siehe unten).
  unique (id, venue_id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null,
  -- denormalisiert: hält RLS-Policy und Gast-Read bei einem Hop
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  description text,
  price_cents int check (price_cents is null or (price_cents >= 0 and price_cents <= 1000000)),
  diet_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  additives text[] not null default '{}',
  image_url text,
  sold_out boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),

  -- Zusammengesetzter FK statt zweier unabhängiger: erzwingt, dass venue_id
  -- der Kategorie entspricht. Ohne das könnte Owner B eine Zeile mit
  -- venue_id = eigenes Venue (RLS-check besteht) und category_id = Kategorie
  -- von Owner A einfügen und damit ein Item in A's Karte schmuggeln.
  constraint menu_items_category_same_venue
    foreign key (category_id, venue_id)
    references public.menu_categories (id, venue_id) on delete cascade
);

create index venue_links_venue_pos_idx on public.venue_links (venue_id, position);
-- Ein Venue kann höchstens je einen menu- und einen review-Block haben.
create unique index venue_links_one_builtin_idx
  on public.venue_links (venue_id, kind) where kind <> 'custom';
create index menu_categories_venue_pos_idx on public.menu_categories (venue_id, position);
create index menu_items_category_pos_idx on public.menu_items (category_id, position);
```

`additives` ist eine zweite Spalte neben `allergens` (Abweichung von der
ersten Skizze): Allergene sind Buchstabencodes (a–n), Zusatzstoffe Zahlen
(1–12). Getrennte Spalten halten die Legende sauber gruppierbar und
erlauben getrennte Validierung.

### 3.2 Menü-Aufrufe: `menu_viewed_at` statt Enum-Wert

```sql
alter table public.tap_events add column menu_viewed_at timestamptz;
```

Begründung für die Abweichung von „`tap_outcome` erweitern": `tap_outcome`
ist eine **Funnel-Position** und `setTapOutcome` hebt eine Zeile genau
einmal von `opened` hoch. Wäre `menu_view` ein Outcome, ginge bei einem
Gast, der erst die Karte liest und danach 4–5★ vergibt, entweder die
Google-Conversion oder der Karten-Aufruf verloren — beides gleichzeitig
zählen ginge nicht. Als eigener nullbarer Zeitstempel sind die zwei Fakten
orthogonal, das Enum bleibt unangetastet (Enum-Werte lassen sich nicht
zurücknehmen), und die Anonymitätsregel gilt unverändert: keine IP, kein
User-Agent, kein Fingerprint.

`conversionPercent` behält seine heutige Bedeutung.

### 3.3 RLS und Grants

Alle drei neuen Tabellen: `enable row level security` plus je eine Policy
nach dem exakten Muster der bestehenden `tables`-Policy:

```sql
create policy "<t>: own venue" on public.<t>
  for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = (select auth.uid())));
```

Keine `anon`-Policies. Gast-Reads laufen ausschließlich über den
Service-Role-Client. Die `alter default privileges` aus der Init-Migration
decken die neuen Tabellen bereits ab; die Migration prüft das nicht erneut,
sondern die RLS-Integrationstests belegen es.

Neuer öffentlicher Storage-Bucket `menu-images`, Pfad `{venueId}/{itemId}.{ext}`.

### 3.4 Feldgrenzen

In den Server Actions durchgesetzt, wie beim bestehenden `.slice(0, 120)`
auf `venues.name`: `hub_tagline` 160, `venue_links.label` 40,
`venue_links.icon` 8, `venue_links.url` 500, `menu_categories.name` 60,
`menu_items.name` 120, `menu_items.description` 400. Maximal 12
`custom`-Blöcke pro Venue, damit die Link-Seite bedienbar bleibt.

### 3.5 Seeding der eingebauten Blöcke

Trigger auf `venues` (after insert), `security definer`, `set search_path = ''`,
analog zu `handle_new_user`:

```
Speisekarte  kind=menu    icon=🍽️  position=0  enabled=true
Bewerten     kind=review  icon=⭐   position=1  enabled=true
```

Als Trigger und nicht im Anwendungscode, damit jeder Pfad (Onboarding,
Tests, manuelle Inserts) konsistente Venues erzeugt. Die Migration
backfillt bestehende Venues mit denselben zwei Zeilen. Sichtbar wird davon
nichts, solange `hub_enabled = false`.

## 4. Routing

```
/f/[code]                → Tap erfassen; hub_enabled ? Hub : Sterne (heutiges Verhalten)
/f/[code]/bewerten       → Sterne, immer
/f/[code]/karte          → gehostete Speisekarte
/f/[code]/[rating]       → unverändert
/f/[code]/danke          → unverändert
```

Statische Segmente gewinnen gegen `[rating]` — `danke` belegt das heute schon.

**Doppelzählung vermeiden.** `/f/[code]` erfasst einen Tap nur, wenn kein
gültiges `?t=` anliegt. Der Hub hängt seine `tapId` an alle internen Links,
und die Karte verlinkt mit `?t=` zurück auf den Hub. Ein Gast, der
Hub → Karte → zurück läuft, erzeugt damit genau eine `tap_events`-Zeile.
Fehlt `?t=` (Direktaufruf, geteilter Link), wird wie heute ein Tap erfasst.

`/f/[code]/karte` setzt `menu_viewed_at` über `markMenuViewed(tapId)` —
idempotent (`where menu_viewed_at is null`) und wie `setTapOutcome` niemals
werfend, nur loggend.

Die Sternen-UI wird aus `f/[code]/page.tsx` in eine gemeinsame Komponente
`f/[code]/star-rating.tsx` gezogen und von beiden Routen benutzt.

## 5. Gast-UI

**Hub** — Logo, Name, optionale Tagline, darunter die aktivierten Blöcke in
`position`-Reihenfolge als große Tap-Targets im bestehenden Terra/Cream-Theme.
`menu`/`review` sind `<Link>` auf interne Routen, `custom` ist
`<a target="_blank" rel="noopener noreferrer">`. `noindex` kommt bereits aus
`f/layout.tsx`.

Zwei Sichtbarkeitsregeln, damit nie eine tote Seite entsteht:
- Der `menu`-Block wird ausgeblendet, wenn das Venue null Items hat — unabhängig von `enabled`.
- Bleibt danach kein Block übrig, fällt der Hub auf die Sternen-Ansicht zurück.

**Speisekarte** — Kopf mit Venue-Name und Zurück-Link, Kategorien in
Reihenfolge, je Item: Name mit Diät-Icons, Beschreibung, Allergen-/
Zusatzstoff-Codes hochgestellt, Preis rechts als `14,00 €` (de-DE),
`sold_out` gedämpft mit Badge „ausverkauft", Foto als Thumbnail. Am Fuß eine
Legende, die **nur die tatsächlich verwendeten** Codes auflistet.
Leere Karte → freundlicher Hinweis plus Zurück-Link.

## 6. Dashboard

Navigation wächst auf sechs Tabs (die Leiste scrollt bereits horizontal).
`nav.tables` wird von „Tische & Links" zu „Tische & QR" umbenannt, damit
„Links" eindeutig die Link-Seite meint.

```
Feedback · Tische & QR · Speisekarte · Link-Seite · Statistik · Einstellungen
```

**`/dashboard/linkseite`** — Schalter „Gäste landen zuerst auf der
Link-Seite" (`hub_enabled`), Tagline-Feld, sortierbare Blockliste mit
▲▼ / Aktiv-Schalter / Bearbeiten / Löschen (nur `custom`), Formular
„Link hinzufügen", plus Vorschau-Link auf `/f/{ersterTischcode}`.

**`/dashboard/speisekarte`** — Kategorien anlegen, umbenennen, sortieren,
löschen. **`/dashboard/speisekarte/[categoryId]`** — Items derselben
Kategorie bearbeiten. Die Zweiteilung hält beide Seiten mobil bedienbar und
beide Dateien klein.

Alles Server Components mit Server Actions und echten `<form>`s, ohne
Client-JS und ohne Drag-and-Drop — wie der Rest des Dashboards. Sortierung
über ▲▼, die zwei `position`-Werte tauschen. Verschachtelte Formulare gibt
es nicht; Zeilenaktionen sind nebeneinanderliegende `<form>`s wie auf der
Tische-Seite.

**Die eine Ausnahme: Foto-Upload.** `src/components/image-upload-field.tsx`
ist eine Client-Komponente, die die gewählte Datei vor dem Absenden im
Canvas auf max. 1200 px längste Kante und JPEG q≈0.82 herunterrechnet und
per `DataTransfer` zurück in das `<input type="file">` schreibt. Ohne das
lädt eine Karte mit 30 Handyfotos auf Café-WLAN nicht. Ohne JavaScript geht
die Originaldatei raus und der Server greift trotzdem: 3 MB Limit,
Typ-Allowlist, Magic-Byte-Prüfung.

## 7. Neue Library-Module

`src/lib/links.ts` — `normalizeLinkUrl(raw): string | null`
Trimmen; leer → `null`; `mailto:`/`tel:` auf Form prüfen und durchlassen;
fehlendes Schema → `https://` voranstellen; mit `new URL` parsen; nur
`https:` zulassen (`http:`, `javascript:`, `data:`, `vbscript:`, `file:`
fliegen raus); leerer Hostname raus; Länge auf 500 begrenzen. Gleiche Haltung
wie das bestehende `isAllowedGoogleReviewUrl`.

`src/lib/money.ts` — `formatPriceCents`, `parsePriceInput`
(akzeptiert `14,00`, `14.00`, `14`; leer → `null`; negativ/Unsinn → Fehler).

`src/lib/menu.ts` — Konstanten für Diät-Tags, die 14 EU-Allergene (a–n) und
die deutschen Zusatzstoff-Nummern (1–12), Code-Validierung und Ableitung der
Legende aus den tatsächlich verwendeten Codes.

`src/lib/hub.ts` — Gast-Read der Hub-Konfiguration über den Service-Role-
Client, plus die Sichtbarkeits- und Sortierregeln aus Abschnitt 5 als reine,
testbare Funktion.

## 8. Fehlerbehandlung

- Unbekannter Code → `InvalidLink` (bestehend).
- Hub ohne sichtbare Blöcke → Sternen-Fallback.
- Karte ohne Items → freundlicher Hinweis, kein 404.
- Analytics-Schreibvorgänge (`markMenuViewed`, `setTapOutcome`) werfen nie.
- Server Actions prüfen Besitz über den RLS-Client, **bevor** der
  Service-Role-Client Storage anfasst — Muster aus `uploadLogo`.
- Item-Löschung entfernt das Storage-Objekt mit (best effort, Fehler nur geloggt).
- Kategorie-Löschung räumt die Fotos ihrer Items **vor** dem DB-Delete ab; der
  `on delete cascade` allein würde verwaiste Storage-Objekte hinterlassen.
- Upload-/Validierungsfehler → Redirect zurück mit `?fehler=1`.

## 9. Tests

**Unit** — `links.test.ts` (inkl. `javascript:` mit führendem Leerzeichen und
gemischter Schreibweise, `data:`, protokollrelatives `//evil.com`,
Überlänge), `money.test.ts`, `menu.test.ts` (Code-Validierung,
Legenden-Ableitung), `hub.test.ts` (Reihenfolge, deaktivierte Blöcke,
Menü-Block ohne Items, leerer Hub).

**Integration** — RLS-Isolation über alle drei neuen Tabellen (Owner B
kommt an nichts von Owner A, weder lesend noch schreibend), `anon` hat keine
Rechte; Trigger legt beim Venue-Insert genau zwei Blöcke an; `stats`-Test um
`menu_viewed_at` erweitert.

**E2E** — Hub-Durchlauf (Hub → Karte mit Preis sichtbar → zurück → Bewerten
→ 2★ → Feedback → Danke); Regressionswächter, dass `/f/{code}` bei
`hub_enabled = false` weiterhin direkt die Sterne zeigt; und der Nachweis,
dass Hub → Karte → zurück genau **eine** `tap_events`-Zeile erzeugt.

## 10. Berührte Dateien

**Neu** — `supabase/migrations/20260822000000_hub_and_menu.sql`;
`src/lib/{links,money,menu,hub}.ts`;
`src/app/f/[code]/{hub.tsx,star-rating.tsx}`;
`src/app/f/[code]/bewerten/page.tsx`; `src/app/f/[code]/karte/page.tsx`;
`src/app/dashboard/linkseite/{page.tsx,actions.ts}`;
`src/app/dashboard/speisekarte/{page.tsx,actions.ts}`;
`src/app/dashboard/speisekarte/[categoryId]/{page.tsx,actions.ts}`;
`src/components/image-upload-field.tsx`; die Tests aus Abschnitt 9.

**Geändert** — `src/app/f/[code]/page.tsx`; `src/lib/guest.ts`
(`markMenuViewed`, Hub-Felder im Venue-Read); `src/lib/venues.ts`
(`hub_enabled`, `hub_tagline`, `menuViews` in `getVenueStats`);
`src/app/dashboard/layout.tsx`; `src/app/dashboard/statistik/page.tsx`;
`messages/de.json`.
