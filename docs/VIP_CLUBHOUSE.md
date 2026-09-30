# vitalityproject.vip — members' clubhouse

**Live on master since 2026-09-30** (60276a2; SQL 001 applied, starter content seeded, crons installed). `vitalityproject.vip` has **no DNS records yet**, so the clubhouse answers only when the Host header reaches the box; clubhouse email is held until the domain resolves (see **Email**). Built 09-29 on Edward's instruction ("zelle for vitalityproject and email is shared from .global .. finish this off entirely use assumptions"). Every assumption is listed under **Assumptions made 09-29 (review)**; every one that is a setting is editable at `/admin/vip/rewards`.

## What it is

The members' community for The Vitality Project. It has a private social feed, a classroom, live events, and rewards that members spend at vitalityproject.global. It has **no store**. Joining, paying, shopping, and spending rewards all hand off to .global's existing flows.

## Architecture

**One database, two front-ends, one Next app.** This follows the 07-23 plan.

```
                 ┌──────────── src/proxy.ts (Next 16 proxy, by Host) ────────────┐
 Host = VIP_HOST │  /feed → rewrite /vip/feed + request header x-vp-site: vip     │
                 │  store APIs → 404, store PWA files → 404, X-Robots-Tag noindex │
 anything else   │  pass-through, untouched (a client-sent x-vp-site is stripped; │
                 │  only /vip*, /api/vip*, /api/sso answer 404)                   │
                 └───────────────────────────────────────────────────────────────┘
 src/app/layout.tsx   root: x-vp-site=vip → bare <html><body>; else master's markup verbatim
 src/app/(store)/…    the store, unchanged
 src/app/vip/…        the clubhouse (metadata overrides every store value)
 src/app/api/vip/…    clubhouse APIs (members only)      src/app/api/sso  SSO consume
 src/app/admin/vip/…  clubhouse admin inside the existing admin (.global host)
```

- **Root layout.** On the clubhouse host the root layout returns a bare document. None of the store's document pieces are rendered, serialised into the RSC payload, or loaded: pixels, JSON-LD, newsletter modal, background canvas, and service worker. `vip/layout.tsx` nulls every inherited store metadata value (description, keywords, manifest, OpenGraph, Twitter, appleWebApp), and `vip/opengraph-image.tsx` replaces the store's OG image file. Reading `headers()` would make every route dynamic, so the four routes that master prerenders keep `dynamic = 'force-static'` (`auth/layout.tsx`, `affiliate/layout.tsx`, `offline/page.tsx`).
- **.global parity (measured).** Master and the branch were built with the same env against the same throwaway DB, and 26 .global URLs were compared. After normalising script/RSC payloads and hashed asset names, 23 are byte-identical in HTML, status, Location and Cache-Control. The 3 that differ:
  - `/sitemap.xml`: only the generation timestamp differs.
  - `/auth/login` and `/auth/register`: the static HTML now contains the pre-rendered form. Master prerendered an empty shell and bailed out to client rendering. The form is identical after hydration: the search params are only read in submit handlers.
  - A tried alternative (two root layouts) was rejected. It changed the og:image on every .global page.
- **Privacy.** Every clubhouse response carries `X-Robots-Tag: noindex, nofollow, noarchive`. Pages also carry noindex metadata, and `/robots.txt` on .vip returns `Disallow: /`. Every `/api/vip/*` response is `Cache-Control: private, no-store`. No page is public except the landing page and sign-in. Profiles are members-only. Member images are stored outside `public/` and served only through `/api/vip/media`, which is members-only. `sharp` re-encodes them, which strips EXIF and GPS data.
- **Access.** Membership uses `getUserMembership()`, the store's rule: the tier counts only while the membership status is `ACTIVE`. PENDING_PAYMENT, PAST_DUE (the lapse cron), PAUSED, and CANCELLED lose the clubhouse at the same moment they lose store benefits. Admins (`role ADMIN`) always get in. Community suspension (`VipProfile.suspendedAt`) removes the feed, directory, and profiles. Classroom, events, and rewards stay available. Both gates are in `src/lib/vip/access.ts`, and every API and every page calls them.
- **Rewards.** Monthly store credit per tier (`VipTierReward`; defaults **Club $5 / Plus $20 / Premium Stacks $50**, admin-editable, 0 = off). The `VIP member rewards` cron runs daily: on the **1st (UTC)** it deposits the reward for members ACTIVE that day and not community-suspended (`&catchUp=1` grants for the current month if the 1st was missed); every day it expires reward credit older than `vip.rewardExpiryMonths` (default 12). Deposits go into the existing `StoreCredit`/`StoreCreditTxn` ledger as `MEMBER_REWARD`, once per member per UTC month (`UNIQUE(userId, period)`, insert `ON CONFLICT DO NOTHING` in the same transaction as the credit). Expiry replays the member's ledger oldest-first (spending uses the oldest credit; only reward credit expires; an `EXPIRE` line is charged to the reward it expired) — no schema change. Both checkouts spend the ledger: card (`useStoreCredit`, unchanged) and Zelle (new, below). The member discount and free shipping keep applying from the membership tier, unchanged.

## Payments: Zelle, and store credit on the Zelle checkout

**Joining (no new vendor).** Each tier card on .vip links to .global's existing Zelle membership flow with the tier preselected: `/membership?tier=club|plus|premium&from=vip`. `from=vip` survives the register round-trip, shows a one-line "Joining the Clubhouse" banner, and after the invoice is created shows **"Your Clubhouse is next"** with a link back to .vip. A member already active on that tier goes straight to `/clubhouse` (SSO). When the admin marks the invoice paid (existing mark-paid), the first activation also sends the **welcome-to-the-Clubhouse email**, which links to `https://vitalityproject.vip/feed` — the hand-off back to .vip. Membership stays one record; .global keeps selling memberships.

**Store credit on the Zelle checkout** (open question 1 — decided):
- At order time the Zelle checkout spends available credit (on by default for signed-in customers; a toggle on `/checkout`). It covers the order after discounts, shipping and tax — the same base the card checkout uses. The debit is one conditional `UPDATE … WHERE balance >= amount` inside the order transaction (`src/lib/order-credit.ts`), recorded as a `CHECKOUT_APPLY` line with `orderId` and in `Order.storeCreditUsed`; `Order.total` is what is still due by Zelle. If the balance changed meanwhile the order is refused (409) and nothing is written. Guests and tenant/B2B orders never spend credit.
- Returned **exactly once** when the order is cancelled (admin), expires unpaid (stale-zelle cron) or is fully refunded: the member's `StoreCredit` row is locked and the amount recomputed from the order's own ledger lines (spent − already returned), written as `CHECKOUT_RESTORE`. A restore on an open or paid order returns nothing. Card orders are untouched.
- **Unpaid expiry** (new, in the existing `stale-zelle-orders` cron): Zelle orders still PENDING+UNPAID after `zelle.unpaidExpiryDays` (default 14, 0 = never) are cancelled and their credit returned. Membership invoices are left to the membership lifecycle. `&dryRun=1` lists what would expire.
- Mark-paid refuses a cancelled order whose credit was already returned (409; re-place the order instead).
- Shown to the customer: store-credit card + summary line on `/checkout`, "Store credit applied" on the confirmation page, and a "Store credit applied" row in the Zelle instructions email (renders nothing when no credit was used, so existing emails are byte-identical).

## Email

All clubhouse email goes through .global's existing `sendEmail` (`src/lib/email.ts` → Resend, **from `noreply@vitalityproject.global`**) with **Reply-To `vital@vitalityproject.global`** (setting `vip.emailReplyTo`; `sendEmail` gained an optional `replyTo`, default unchanged). Templates: `src/lib/vip/emails.ts`. Flows: `src/lib/vip/mailer.ts`.

| Email | When | Once-only guard | Opt-out |
|---|---|---|---|
| Welcome to the Clubhouse | first membership activation (mark-paid), or first clubhouse visit for members active before launch | `VipProfile.welcomeEmailAt` claimed before send | one-time |
| Reply/mention digest | daily from `vip.digestHourUtc` (13 UTC) when there are unread replies/comments/mentions since the last digest | `VipProfile.digestSentAt` claim | `emailDigest`; also the store-wide `CommunicationPreference.marketingEmail = false`; suspended members get none |
| Event reminder | 24 h and 1 h before sessions the member RSVP'd to (a late RSVP gets only the 1 h one) | `VipEventRsvp.reminded24hAt` / `reminded1hAt` claims | `emailEvents` |
| Monthly reward issued | right after the 1st-of-month grant | the grant is once per month | `emailRewards` |

Every email carries signed one-click preference links (`/email?u&k&t`, HMAC with `NEXTAUTH_SECRET`); the page changes nothing until the member presses the button, so mail scanners can't unsubscribe anyone. Members also toggle all three on their profile. Event emails show times in `vip.timeZone` (America/New_York) and link to the Events page — the join link stays inside the clubhouse. Tests mock `sendEmail`; nothing was sent from tests or local runs.

**Held until the domain resolves.** Every clubhouse email links to vitalityproject.vip, so `sendVipEmail` sends nothing until the domain has an A or AAAA record on public DNS (1.1.1.1 / 8.8.8.8, checked from the app; a "not yet" is re-checked every 5 minutes, a "yes" is remembered; `lib/vip/live.ts`). A held welcome releases its claim and goes out on the member's next trigger. A held reward notice stays pending (`vip_reward_grants.noticeAt` null) and the daily rewards run sends it on a later day of the same month; a month's notice is never sent after that month ends. The store credit itself is never held. `VIP_MAIL_REQUIRE_DNS=0` turns the check off.

New cron `/api/cron/vip-notify` (every 15 min): event reminders, the digest, and the next date of each **monthly event series** (`VipEvent.repeatMonthly`: when the latest occurrence starts, the next one — same weekday-of-month, same local time — is published; untick "Repeats monthly" on the latest to end a series).

## Content

- **Copy** is finished: `src/lib/vip/copy.ts` (landing, tiers — bullets built from live settings — join steps, FAQ, sign-in, empty states, "Start here" onboarding checklist, classroom/events/rewards intros, Guidelines `/guidelines`, Privacy `/privacy`, suspended, 404, email preference page) and the email templates. The .global `/account/membership` card now reads **"Enter the Clubhouse — Your members' community, classroom and live sessions at vitalityproject.vip."**
- **Brand:** navy + white + vital blue, champagne gold for premium; purple is gone from .vip (brand-* CSS variables re-themed under `body.vip-theme`, set only in the clubhouse branch of the root layout). No gradient text. Original **VP monogram** (`src/components/vip/monogram.tsx`, favicon `src/app/vip/icon.svg`, OG image `src/app/vip/opengraph-image.tsx`). noindex unchanged.
- **Guard:** `test/vip/seed-and-copy.test.ts` scans every clubhouse source and the starter content for product / dosing / supplier / model wording, paragraphs starting with "And", leftover "copy needed" slots and gradient-text utilities. The rewards history on .vip shows plain labels, never raw ledger descriptions (an admin refund reason can't leak product wording onto .vip).
- **Starter content** (`scripts/vip/starter-content.ts`, `starter-courses.ts`): 8 spaces (Announcements [team-only], Introductions, Wins & Check-ins, Training Lab, Fuel & Nutrition, Sleep & Recovery, Longevity Reads, Ask the Coaches); pinned Welcome + Guidelines posts from the team account; 3 courses / 10 modules / 32 lessons (Clubhouse Orientation — every level; Foundations: Sleep, Training, Fuel — Plus+; The 12-Week Performance Reset — Premium Stacks); 3 monthly event series, first dates relative to the seed run, **join link empty for the admin** (any https URL — Zoom, Meet, anything).
- **Production seed** `scripts/seed-vip-clubhouse.ts` (`npm run vip:seed`): insert-only, safe to re-run, never updates or deletes a row, `--dry-run` prints the plan. No members, no member posts. `VIP_SEED_AUTHOR_EMAIL` = an existing ADMIN account (the team posts' author; given the display name "Vitality Team" only if that admin has no clubhouse profile yet).
- **Dev seed** `npm run vip:seed-dev`: the same starter content plus clearly fake `zz-*@example.invalid` members and activity, for local screenshots only.

## SSO (.global → .vip)

1. A signed-in active member on .global opens `/clubhouse`. This is the mint side, merged from `feat/vip-sso-handoff`. It mints a 120-second HS256 JWT with `sub`, `email`, and a random `jti`, then redirects to `https://vitalityproject.vip/api/sso?token=…&callbackUrl=/dashboard`.
2. `/api/sso` (the consume side) does four things:
   - verifies the signature, issuer, and expiry
   - inserts the `jti` into `vip_sso_consumed_tokens`, so a replay is refused
   - checks that the user exists and that the email claim matches
   - issues the **same next-auth JWT session cookie**, scoped to the .vip host, and redirects with a relative Location.
3. Members can also sign in directly on .vip at `/signin` → `/api/vip/auth/login`, using the same email or username and password. It uses `authorizeCredentials`, the credentials check extracted unchanged from `authOptions`.

## Environment variables (names only)

| Var | Where | Notes |
|---|---|---|
| `VIP_HOST` | app | Host(s) that serve the clubhouse. Comma list; `www.` is added automatically. Default `vitalityproject.vip`. |
| `VIP_SSO_SECRET` | app | Shared HS256 secret for the SSO token. Mint and verify run in the same app, so this is **one** value. |
| `NEXT_PUBLIC_VIP_URL` | app (build-time) | e.g. `https://vitalityproject.vip`. Used by `/clubhouse` and the clubhouse metadata. |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | existing | Unchanged. The .vip session cookie is signed with the same secret. |
| `NEXT_PUBLIC_APP_URL` | existing | The .global origin. The clubhouse uses it for join, shop, and credits hand-off links. |
| `CRON_SECRET` | existing | Also protects `/api/cron/vip-member-rewards` and `/api/cron/vip-notify`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | existing | Clubhouse mail uses the same sender. Reply-To is the admin setting `vip.emailReplyTo`, not an env var. |

The 09-29 additions need **no new env vars**. Their knobs are `site_settings` rows with code defaults (nothing is written until an admin saves): `vip.rewardExpiryMonths` (12), `vip.emailReplyTo` (vital@vitalityproject.global), `vip.digestHourUtc` (13), `vip.timeZone` (America/New_York), `zelle.unpaidExpiryDays` (14).

`NEXTAUTH_COOKIE_DOMAIN`, if it is set in production, still applies only to .global cookies. The clubhouse cookie never sets a Domain.

## Migration

- File: `prisma/migrations-manual/001_vip_clubhouse.sql`. It is additive, and running it twice changes nothing. It adds two enum values (`CreditTxType.MEMBER_REWARD`, `CHECKOUT_RESTORE`) and new `vip_*` tables, columns (`ADD COLUMN IF NOT EXISTS` on the new `vip_*` tables only), indexes, and foreign keys. It does not ALTER or UPDATE anything that already exists.
- Proof: `npm run verify:vip-migration` pushes origin/master's schema into a throwaway PGlite DB and applies the SQL **twice**. It then checks that `prisma migrate diff` against `schema.prisma` is empty.
- **Apply order:** (1) back up Neon (see BACKUP_DR.md), (2) `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations-manual/001_vip_clubhouse.sql`, (3) deploy the app — see the runbook below. The deploy workflow's `prisma db push` then finds nothing to change. If step 2 is skipped, that `db push` creates the same objects, because they are all additive.

## Deploy runbook (in order — nothing here has been executed)

Box: Hetzner `/opt/vitality`, SSH port 2222. A push to `master` auto-deploys through `.github/workflows/deploy.yml` (`prisma db push`, then `up -d --build app`).

1. **Close port 3000 to the internet first.** The app container publishes `3000:3000` on all interfaces and ufw is off, so the Next server is reachable directly, bypassing nginx and Cloudflare. This branch changes `docker-compose.yml` to `"127.0.0.1:3000:3000"` (nginx already reaches the app as `app:3000` on the compose network). To close it before the merge, make the same one-line edit on the box and restart only the app, then commit that change back (or let the merge carry it — the file is identical):
   ```
   cd /opt/vitality
   sed -i 's|- "3000:3000"|- "127.0.0.1:3000:3000"|' docker-compose.yml
   docker compose up -d app
   curl -sI http://127.0.0.1:3000/api/health | head -1      # 200 from the box
   # from outside: curl -m 5 http://<box-ip>:3000/  → must time out / refuse
   ```
2. **Back up Neon** (docs/BACKUP_DR.md).
3. **Env** — add to `/opt/vitality/.env.production` (values generated on the box, never pasted anywhere else):
   ```
   VIP_HOST=vitalityproject.vip
   VIP_SSO_SECRET=$(openssl rand -base64 48)
   NEXT_PUBLIC_VIP_URL=https://vitalityproject.vip
   ```
   Check the shape: no quotes, no trailing whitespace/newline (`grep -n 'VIP_' .env.production | cat -A`). `NEXT_PUBLIC_VIP_URL` is build-time, so it must be in place before the deploy builds.
4. **Private uploads dir** (member photos, outside `public/`):
   ```
   mkdir -p /opt/vitality/private-uploads && chown 1001:1001 /opt/vitality/private-uploads
   ```
5. **SQL** (additive, idempotent; run it twice if in doubt):
   ```
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations-manual/001_vip_clubhouse.sql
   ```
6. **Merge** `feat/vip-clubhouse` → `master` (auto-deploys). The workflow's `db push` then finds nothing to change.
7. **Seed the starter content** (insert-only; dry run first). Use an existing ADMIN account as the team author:
   ```
   docker compose run --rm migrate sh -c 'VIP_SEED_AUTHOR_EMAIL=<admin email> npx tsx scripts/seed-vip-clubhouse.ts --dry-run'
   docker compose run --rm migrate sh -c 'VIP_SEED_AUTHOR_EMAIL=<admin email> npx tsx scripts/seed-vip-clubhouse.ts'
   ```
   Then in `/admin/vip/events` paste the Zoom/Meet link into each of the three events.
8. **Cron lines** — add next to the existing jobs. Run every one with `dryRun=1` by hand first and read the output:
   ```
   # dry runs (by hand, once)
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://vitalityproject.global/api/cron/vip-member-rewards?dryRun=1&catchUp=1"
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://vitalityproject.global/api/cron/vip-notify?dryRun=1"
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://vitalityproject.global/api/cron/stale-zelle-orders?dryRun=1"
   ```
   The stale-zelle dry run lists every existing unpaid Zelle order older than 14 days that the first real run would **cancel** — review it (or set "Unpaid Zelle orders cancel after" to 0 in `/admin/vip/rewards`) before the hourly job runs again.
   ```
   # crontab
   15 0 * * *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-member-rewards >/dev/null
   */15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-notify >/dev/null
   ```
   (`stale-zelle-orders` is already scheduled; it now also performs the expiry.) Rewards grant only on the 1st; the daily run also handles expiry.
9. **nginx**: no change (`server_name _` proxies any Host with `proxy_set_header Host $host`).
10. **Smoke test**: `https://vitalityproject.vip/` has `x-robots-tag`; `/feed` → `/signin`; sign in as a real member → feed with the pinned welcome; `.global/account/membership` → "Enter the Clubhouse" lands on the .vip feed; a tier card on .vip opens `.global/membership?tier=…&from=vip` with that tier selected; `/admin/vip/rewards` shows the settings and the dry-run preview.

## DNS for vitalityproject.vip (Cloudflare zone — currently no records; the zone is in a Cloudflare account none of our tokens reach)

- `A  vitalityproject.vip  → 178.104.155.129`, **proxied**.
- `CNAME  www  → vitalityproject.vip`, proxied.
- SSL/TLS mode must match .global's zone (origin nginx listens on :80 only → Flexible, as .global presumably runs; or add an origin cert + 443 block before using Full).
- Mail: none needed on .vip — clubhouse mail is sent from `noreply@vitalityproject.global` (already authenticated for Resend) with Reply-To `vital@vitalityproject.global`.

## Assumptions made 09-29 (review)

Settings are editable at **/admin/vip/rewards** (reward amounts + "Clubhouse settings"); content is editable in the clubhouse admin.

| # | Assumption | Where to change |
|---|---|---|
| 1 | Payments stay Zelle through .global's existing membership invoice flow; no new vendor. .vip tier cards hand off with the tier preselected. | — |
| 2 | Zelle checkout spends available store credit by default (customer can untick). Covers shipping + tax, same base as card. | checkout toggle |
| 3 | Credit returns exactly once on cancel, unpaid expiry or **full** refund. A partial refund returns cash/refund-credit only; the spent credit stays spent. | code (`order-credit.ts`) |
| 4 | Unpaid Zelle orders auto-cancel after **14 days** (credit returned). Membership invoices excluded. Loyalty points and discount-code uses on an expired order are not returned (same as an admin cancel today). | `zelle.unpaidExpiryDays` (0 = off) |
| 5 | Membership dues are not payable with store credit (credit is for store orders). | code |
| 6 | Monthly reward: **Club $5 / Plus $20 / Premium Stacks $50** store credit. Tier names, prices and 5/10/15% discounts unchanged. | reward amounts (0 = off) |
| 7 | Granted on the **1st (UTC)** to members ACTIVE that day; PAST_DUE / PAUSED / CANCELLED / PENDING and community-suspended members get none (open question 4). New members start on the next 1st. | `catchUp=1` for a missed 1st |
| 8 | Reward credit expires **12 months** after issue; other credit never expires; spending uses the oldest credit first. | `vip.rewardExpiryMonths` (0 = never) |
| 9 | Reward credit applies at checkout after the member discount (it is credit, stacking with nothing else). | — |
| 10 | Clubhouse email Reply-To **vital@vitalityproject.global**; sender stays noreply@vitalityproject.global. | `vip.emailReplyTo` |
| 11 | Digest daily at **13:00 UTC** (9 am Eastern in summer), only when there is something new; honours the store's marketing opt-out. | `vip.digestHourUtc` |
| 12 | Event reminders go to members who RSVP'd (24 h + 1 h); times shown in **America/New_York**. | `vip.timeZone`, per-member toggle |
| 13 | Welcome email on first activation, or first visit for members active before launch. | — |
| 14 | Course gating: Orientation all levels, Foundations Plus+, 12-Week Reset Premium Stacks. | course "minimum tier" |
| 15 | Events: Live Q&A with Kevin (1st Thu 7 pm ET, all levels), New Member Kickoff (2nd Wed 7:30 pm ET, all levels), Premium Stacks Roundtable (3rd Tue 8 pm ET, Premium). Monthly series; join link left empty. | admin events |
| 16 | Video: any URL (YouTube/Vimeo embed privately; anything else is a link). | lesson video field |
| 17 | Moderation limits unchanged: 5 posts / 10 min, 20 comments / 10 min, 5 links per post, 10-minute duplicate check, 12 MB images. | code (`lib/vip/guard.ts`) |
| 18 | Existing .global members keep their membership — it is one record; the clubhouse simply opens for them. No migration. .global keeps selling memberships (same tiers, same records). | — |
| 19 | All copy (landing, tiers, onboarding, courses, guidelines, privacy notice, emails, the .global card) written by the agent in the brand voice. Kevin's Hacksmith-branded docs were not used. | `lib/vip/copy.ts`, `emails.ts`, admin classroom |
| 20 | Logo: an original "VP" monogram (white V, gold P, navy tile) in place of Kevin's 09-21 PNGs, which are not in the repo. | `components/vip/monogram.tsx`, `app/vip/icon.svg` |
| 21 | App port 3000 bound to loopback in `docker-compose.yml`. | — |

## Intended differences on vitalityproject.global

Measured 09-29: master and this branch built with the same env against the same throwaway DB, 26 .global URLs compared (normalised scripts/asset hashes). **23 identical; the same 3 known differences as before** (`/sitemap.xml` timestamp; `/auth/login` and `/auth/register` now prerender the form). The intended .global changes are not in those 26 anonymous URLs because they render only for signed-in customers or on the client:
- `/account/membership` card copy → "Enter the Clubhouse / Your members' community, classroom and live sessions at vitalityproject.vip."
- `/checkout` store-credit card + summary line (only when the customer has credit); confirmation page and Zelle instructions email "Store credit applied" line (only when credit was used).
- `/membership` "Joining the Clubhouse" banner and "Your Clubhouse is next" panel (only with `?from=vip`).
- Admin: clubhouse settings form, "Repeats monthly" on events; mark-paid refuses a cancelled order whose credit was returned; stale-zelle cron now cancels unpaid orders after 14 days.

Pre-existing on master (not from this branch): `/membership` throws React hydration error #418 in the browser on master too.

## Quality (09-29)

`npx tsc --noEmit` exit 0 · `npm test` exit 0 (11 files, 105 tests, own throwaway PGlite DB) · `npm run verify:vip-migration` exit 0 · `npm run build` exit 0 · 20 hand-written mutants (credit spend/restore, unpaid expiry, reward eligibility/timing/defaults/idempotency, expiry replay, email claims, preference tokens, insert-only seed, copy guard) — all killed. Screenshots (desktop 1440 + 390 mobile) in `Downloads/VIP_Clubhouse_screens/`.

## Local development

```
npm run vip:dev-db                         # throwaway PGlite Postgres on 127.0.0.1:54329 (.vip-dev-db/)
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&pgbouncer=true&connection_limit=1"
npx prisma db push --skip-generate && npm run vip:seed-dev   # starter content + zz-*@example.invalid fakes
npm run dev   → http://localhost:3000/?__host=vip  (dev-only override; ?__host=global to leave)
# or production mode: VIP_HOST=vip.localhost, next build && next start → http://vip.localhost:3000
npm test      # refuses any non-127.0.0.1 DATABASE_URL; sendEmail/SMS are mocked
```

## What still needs Kevin (none of it blocks launch)

1. **Join links** for the three monthly events (Zoom, Meet — any https link) and whether the default days/times suit him.
2. **His logo files**, if he prefers his 09-21 "VP" PNGs to the monogram drawn here (commit them under `public/` and swap `Monogram`).
3. **A read of the copy and the three courses** — they are written in his voice about him ("Live Q&A with Kevin"); edit anything in the clubhouse admin.
4. **Reward amounts and expiry** — defaults are live settings; he can change them any day.
5. Still open from the research brief and **not** decided here: rights to the "VIP CONTENT" / "BEGINNING PEPS" material (Hacksmith-branded, human dosing — kept out entirely), and which contact address is canonical (vital@vitalityproject.global is used as Reply-To).
