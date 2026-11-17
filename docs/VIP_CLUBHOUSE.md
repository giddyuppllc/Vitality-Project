# vitalityproject.vip — members' clubhouse

**Live on master since 2026-09-30** (60276a2; SQL 001 applied, starter content seeded, crons installed). `vitalityproject.vip` has **no DNS records yet**, so the clubhouse answers only when the Host header reaches the box; clubhouse email is held until the domain resolves (see **Email**). Built 09-29 on Edward's instruction ("zelle for vitalityproject and email is shared from .global .. finish this off entirely use assumptions"). Every assumption is listed under **Assumptions made 09-29 (review)**; every one that is a setting is editable at `/admin/vip/rewards`.

## What it is

The members' community for The Vitality Project. It has a private social feed, a classroom, live events, and rewards that members spend at vitalityproject.global. It has **no store**. Joining, paying, shopping, and spending rewards all hand off to .global's existing flows.

## Architecture

**One database, two front-ends, one Next app.** This follows the 07-23 plan.

```
                 ┌──────────── src/proxy.ts (Next 16 proxy, by Host) ────────────┐
 Host = VIP_HOST │  /feed → rewrite /vip/feed + request header x-vp-site: vip     │
                 │  store APIs + every public/ file → 404, X-Robots-Tag noindex   │
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
Until vitalityproject.vip resolves, the .global "Enter the Clubhouse" card is hidden and `/clubhouse` returns the member to `/account/membership` (same DNS check as the email hold); both switch on by themselves once the records exist.

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
- **002 (the platform, `vip/integration`):** `prisma/migrations-manual/002_vip_platform.sql` — generated with `prisma migrate diff` (origin/master → this schema), made idempotent, hand-checked. Five `LoyaltyTxType` values; two **nullable** columns on `loyalty_transactions` (`idempotencyKey`, `source`) with a plain index; nullable/defaulted columns on existing `vip_*` tables; 9 enum types, 51 new tables (`vip_*` + `loyalty_tx_keys`), their indexes and foreign keys. Nothing altered, dropped, updated or deleted. Apply after 001, before the deploy: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations-manual/002_vip_platform.sql`.
- **Why `loyalty_tx_keys`:** the foundation branch made `loyalty_transactions.idempotencyKey` `@unique`. Adding a unique constraint to that existing, populated table makes `prisma db push` stop with *"A unique constraint … will be added"* and demand `--accept-data-loss` — the deploy would have failed. Exactly-once now lives in the new table (primary key = the idempotency key, written in the same transaction as the ledger line; `keyLedgerLine()` in `lib/vip/points.ts`).
- **Proof (`npm run verify:vip-migration`, two paths):** (A) master schema → 001 and 002 applied **twice each** → statement-level additive check → `migrate diff` empty. (B) the deploy path: master schema + rows in `users`, `memberships`, `vip_profiles`, `vip_posts`, `vip_reports`, `loyalty_accounts`, `loyalty_transactions` → `prisma db push --skip-generate` **without** `--accept-data-loss` → exit 0, no warning, every row intact, `migrate diff` empty.

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

## Review fixes (11-17, branch `review/clubhouse`)

- **Admin pages and partial rendering.** A layout is not an access check: a request with `RSC: 1` and a `Next-Router-State-Tree` that claims the admin layout is already rendered gets the page segment without the layout running. Every `/admin/vip` page now calls `requireAdminPage()` (`lib/vip/page-gate.ts`). `src/proxy.ts` also checks the role for every `/admin` page on .global. Before this, 29 of the 47 static store admin pages could be read anonymously, `/admin/customers` among them.
- **SSO `callbackUrl`.** Control characters are refused. Browsers strip tab and newline characters from a Location, so `/\t/evil` used to resolve to `//evil`.
- **Uploads.** `experimental.proxyClientMaxBodySize: '25mb'`. With a proxy in place, Next cut request bodies off at 10MB. That broke 10–12MB clubhouse photos and 10–25MB admin uploads on .global.
- **Host isolation.** On .vip, the files in `public/` (product photos, COAs, logos, hero video) and `/api/auth/register` and `/api/auth/post-login` now return 404.
- **Direct sign-in.** The login-CSRF check now compares the MIME essence. A request sent as `text/plain; application/json` used to pass.
- **Events.** Moving an event's start time re-arms the 24h and 1h reminders.
- **UI.** Signed-in non-members now have a Sign out button. Axe (WCAG 2.1 AA) reports no violations at 390px or 1440px: small-print contrast and accessible names were fixed.

## Rewards points economy + partner network (branch `vip/rewards`, 11-17)

One balance per member (`LoyaltyAccount.points`, 100 points = $1); every movement goes through `lib/vip/points.ts`.

- **Earning** (`lib/vip/earning.ts`, admin: `/admin/vip/rewards/earning`): .global purchases pay active members a 5% base × Club 1 / Plus 1.5 / Premium Stacks 2 (never below the store's 1 pt/$1; non-members unchanged), exactly once per order (`purchase:<orderId>`) — on mark-paid **and** the order-detail PATCH paid path. Every other amount is in the one **earning-rules registry** (see *Platform integration* below). Optional checkout cap `vip.points.redeemCapPct` (default **0 = off**, the plan suggests 50): `maxRedeemablePoints()` in both checkouts.
- **Referral:** member number = referral code; `.global/membership?ref=<number>` → subscribe records a `VipReferral`; mark-paid's first activation pays the referrer once.
- **Catalog** (`lib/vip/catalog.ts`): STORE_CREDIT (instant, `LOYALTY_REDEEM` credit), TRAINING (instant `VipCourseGrant` via `grantTrainingAccess(userId, courseId)`; classroom honours grants), PRODUCT / MERCH / EXPERIENCE (requests; queue at `/admin/vip/rewards/redemptions`, requested → approved → fulfilled / cancelled with points returned exactly once). PRODUCT is a fulfilment request, not a discount code; stock is taken with `decrementStock` when fulfilled.
- **Expiry:** whole balance after `vip.points.expiryMonths` (12) without any points activity. Cron `/api/cron/vip-points-expiry` (daily, `dryRun=1`). **This applies to every loyalty account, including .global non-members — run the dry run and read it before scheduling.**
- **Partners:** `/admin/vip/partners` (partner, staff by email → `VipPartnerStaff`, earn pts/$1, redemption on/off, network fee). Staff use `vitalityproject.vip/partners/portal`. Statements per UTC month at `/admin/vip/partners/statements`; cron `/api/cron/vip-partner-statements` (daily, acts on the 1st, `dryRun=1`, `period=YYYY-MM`). CSV export via `lib/csv`.
- **Badges/leaderboard:** `VipUserBadge` (one table shared by rewards, social and fitness); monthly points-earned leaderboard honours the one opt-out (`VipProfile.hideFromLeaderboards`, `lib/vip/leaderboards.ts`).

Crontab additions (dry-run first):
```
20 0 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-points-expiry >/dev/null
30 0 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-partner-statements >/dev/null
```

**Partner-model assumptions (confirm with Kevin):** (1) net settlement = network fee − value of points spent at the partner; points issued at a partner are shown as the network's liability but not billed to the partner. (2) Partner earn is a flat per-partner rate (default 5 pts/$1), not tier-scaled. (3) Only ACTIVE members earn or spend at partners. (4) Partners record purchases with a receipt number (one award per receipt); voids within 24 h at the counter, later via the team; no voids once the month's statement is issued. (5) Spending requires the member's 6-digit code bound to partner + amount (10 min, single use, 5 wrong tries). (6) Default network fee 5% of member turnover. (7) Statements are UTC calendar months and are only recorded — settlement is Zelle outside the app.

## Platform integration (branch `vip/integration`, 11-17)

`vip/foundation` (shared points ledger) + `vip/rewards` + `vip/academy` + `vip/social` + `vip/fitness`, merged in that order with every seam resolved. Nothing here is on master; **pushing to master deploys production**.

### What members get

| Area | Routes (all members-only unless noted) | Built by |
|---|---|---|
| Home | `/dashboard` — greeting, tier/renewal, points; continue learning; **today's workout** (program day / open workout / trained today) + **check-in** state and streak; **active challenges**; sessions; **posts from people you follow** (latest when you follow nobody); **rewards catalog** against your balance. One parallel load (`lib/vip/dashboard.ts`). | academy + integration |
| First run | `/welcome` — profile, interests, goals, notifications, learning path, **follow suggested members** (social), **training units** (fitness). Re-run from Settings. | academy + integration |
| Community | `/feed` (Everyone / Following / Saved / Discover tabs), `/posts/[id]`, `/tags/[tag]`, `/discover`, `/saved`, `/members`, `/members/[id or @username]` (follow, block, message; followers-only profiles), `/notifications` | social |
| Messages | `/messages`, `/messages/new`, `/messages/[id]` — 1:1 and groups up to 20, photos, shared posts, receipts, report. **DM photos load only for current participants** (not after leaving, not while suspended; admins only for reported conversations via `/api/admin/vip/media`, page views audit-logged). A DM photo must be a fresh upload. | social + integration |
| Academy | `/classroom`, `/classroom/paths/[slug]`, `/classroom/[slug]`, `/classroom/lessons/[id]`, `/classroom/quizzes/[id]`, `/certificate/[code]`, public `/verify` + `/verify/[code]` (course + date only) | academy |
| Library / Events | `/library`; `/events` (calendar, waitlist RSVP, `.ics`, recordings, **Join** via `/api/vip/events/[id]/join`) | academy + integration |
| Fitness | `/fitness` (Today), `/fitness/programs[/slug]`, `/fitness/exercises[/slug]`, `/fitness/workout/[id]` (logger), `/fitness/history[/id]`, `/fitness/health` (check-in, measurements, private progress photos), `/fitness/challenges[/slug]`, `/fitness/lifestyle[/slug]` | fitness |
| Rewards | `/rewards` (balance, member card, **How to earn**, badges, history, monthly credit), `/rewards/catalog`, `/rewards/redemptions`, `/rewards/partners` (`/partners` redirects), `/rewards/leaderboard`, `/rewards/card`; partner staff: `/partners/portal` | rewards |
| Account | `/profile`, `/settings` | social + academy |

Admin (on .global; every page checks the role itself): `/admin/vip` (moderation), `members`, `spaces`, `classroom[/id]`, `events`, `library`, `fitness` (+ `exercises`, `programs[/id]`, `challenges[/id]`, `articles[/id]`), `rewards` (monthly credit), `rewards/catalog`, `rewards/redemptions`, `rewards/earning`, `rewards/points`, `partners[/id]`, `partners/statements`, `conversations/[id]` (reported DMs only).

### Navigation — `src/lib/vip/nav.ts` is the only nav config

- **Mobile bottom bar (exactly five + More):** Home `/dashboard` · Community `/feed` · Learn `/classroom` · Fitness `/fitness` · Rewards `/rewards`.
- **More sheet / desktop rail "Explore":** Messages `/messages` (live unread badge) · Discover · Saved · Events · Library · Partners `/rewards/partners` · Members · Profile · Settings. Community-only items (Community, Messages, Discover, Saved, Members) disappear for suspended members.
- One unread-messages count (server value from the `(club)` layout, then polled by the shell) feeds the rail, the More sheet and the **mobile-only** top-bar Messages icon; the More tab's total leaves Messages out so the count never shows twice. `/rewards/partners` lights Partners, not Rewards (`exclude`). `test/vip/events-library-pwa.test.ts` checks every href has a page and every tab label fits 390px.

### Earning rules — ONE registry (`lib/vip/earning.ts`)

Every award reads it; the admin page `/admin/vip/rewards/earning` is generated from it (grouped), and the member **How to earn** table (`earningTable()` in `lib/vip/points-view.ts`) is generated from it — they cannot drift. 0 turns a rule off (and hides it from members). Values live in `site_settings`; a missing row = the default.

| Group | Key | Default | Paid when (idempotency key) | Older key still read |
|---|---|---|---|---|
| Purchases | `vip.points.purchaseBaseBps` | 500 (5%) | .global order paid — mark-paid or order PATCH (`purchase:<orderId>`) | — |
| | `vip.points.multClub` / `multPlus` / `multPremium` | 100 / 150 / 200 (%) | tier multiplier | — |
| Referrals | `vip.points.referral` | 2,500 | referred member's first invoice paid (`referral:<userId>`) | — |
| Academy | `vip.points.lesson` | 50 | lesson complete (`lesson:<lessonId>:<userId>`) — the only lesson award | `vip.points.lessonComplete` |
| | `vip.points.quiz` | 25 | module check passed (`quiz:<quizId>:<userId>`) | `vip.points.quizPassed` |
| | `vip.points.course` | 500 | course finished, with certificate (`course:<courseId>:<userId>`) | `vip.points.courseComplete` |
| Community | `vip.points.firstPost` | 100 | first post (`first-post:<userId>`) | — |
| | `vip.points.postDay` | 10 | posting day, clubhouse time zone (`post-day:<userId>:<date>`) | — |
| Fitness | `vip.points.workout` | 25 | workout finished, once per local day (`workout-day:<userId>:<date>`) | `vip.fitness.points.workout` |
| | `vip.points.checkin` | 5 | daily check-in (`checkin:<userId>:<date>`) | `vip.fitness.points.checkin` |
| | `vip.points.streak7` | 100 | each 7-day check-in block (`streak7:<userId>:<start>`) | `vip.fitness.points.streak7` |
| | `vip.points.program` | 500 | program completed (`program-complete:<userId>:<programId>`) | `vip.fitness.points.programComplete` |
| | `vip.points.challengeDefault` | 200 | pre-fills a NEW challenge's points; each challenge pays its own amount (`challenge:<userId>:<id>`) | — |
| Events | `vip.points.event` | 100 | Join opened while the session is live, 15 min before start to end (`event:<eventId>:<userId>`) | — |
| Balance | `vip.points.expiryMonths` | 12 | whole balance expires after N months without activity (cron) | — |
| | `vip.points.redeemCapPct` | 0 (off) | max % of an order's goods payable with points | — |

Older keys (from the feature branches — never on production) are read as fallbacks when the canonical key has no row; saving always writes the canonical key, so no data migration is needed. The clubhouse settings API and the fitness settings API still accept the old keys and write through the registry. The classroom and fitness admin pages show a read-only summary linking to the one page. Rewards' "monthly active streak" rule was removed: nothing ever paid it.

### Seams resolved

- **One schema:** `VipUserBadge` once (social's shape, with the User relation); `VipCourseGrant` once — `lib/vip/course-grants.ts` is the only reader/writer (rewards' TRAINING items, academy's points and Zelle purchases, admin grants); access is decided in `lib/vip/classroom.ts` via `allowsTier()` (admin, then grant, then purchase-only, then tier). A TRAINING reward for a purchase-only course is no longer wrongly refused as "already unlocked" for a high tier.
- **One leaderboard opt-out:** `VipProfile.hideFromLeaderboards` (`lib/vip/leaderboards.ts`) for the points board and every challenge board; one toggle component on Rewards and Fitness; the fitness prefs API writes the same flag. `VipFitnessProfile.hideFromLeaderboards` stays in the schema (additive only) and is unused.
- **Paid paths:** mark-paid runs membership activation + referral payout, the TRAINING invoice grant (no fulfilment, stock, points or commission), or the goods pipeline with tier-scaled points; the order PATCH path does the same for goods and training invoices. Each award is keyed, so either path, double clicks and races pay once (`test/vip/integration.test.ts`, `test/global/money-path.test.ts`).
- **Admin images:** `/api/admin/vip/images` + one `ImageField` (paste https or upload) for course, program, challenge and article covers, exercise images, reward images and partner logos. Stored in the members-only media store (`private-uploads/vip`, re-encoded, metadata stripped) and shown to signed-in members at `/api/vip/media/…` — no outside hosting. Documents stay on `/api/admin/vip/files` (per-lesson access).
- **Favicon:** academy's `icons` metadata had replaced the `icon.svg` convention, so browsers asked for `/favicon.ico` (404 on .vip); the monogram is linked explicitly.

### Crons (all `Authorization: Bearer $CRON_SECRET`; run each with `dryRun=1` by hand first)

```
15 0 * * *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-member-rewards >/dev/null      # existing
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-notify >/dev/null              # existing (now also follows + messages in the digest)
20 0 * * *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-points-expiry >/dev/null       # NEW — every loyalty account; read the dry run first
30 0 * * *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-partner-statements >/dev/null  # NEW — acts on the 1st; period=YYYY-MM to redo a month
```
`stale-zelle-orders` keeps its existing schedule (it also expires unpaid training invoices like any Zelle order). Academy and fitness add no cron: waitlist promotion, challenge completion and streaks happen on member activity.

### Seeds (all insert-only; `--dry-run` first)

- `npm run vip:seed` — starter clubhouse content, now with 9 learning paths and the quizzed *Reading the Research* course (`scripts/vip/starter-academy.ts`). Existing courses are left alone (assign paths in admin).
- `npm run vip:seed-fitness` — 22 generic exercises for review (`scripts/seed-vip-fitness.ts`).
- Dev only (127.0.0.1 throwaway DB, zz fakes): `npm run vip:seed-dev`, `npm run vip:seed-fitness-dev`.

### Environment

No new variables. Uploads: `private-uploads/vip` (member and admin images), `private-uploads/vip-docs` (Academy / Library files), `private-uploads/vip-progress/<userId>` (owner-only progress photos) — all inside the existing `/opt/vitality/private-uploads` volume.

### Proof (11-17)

`npx tsc --noEmit` 0 · `npm test` 0 (47 files, 491 tests) · `npm run build` 0 · `npm run verify:vip-migration` 0 (both paths). A production build on a throwaway DB (`node scripts/vip/throwaway-db.mjs --port 54350 --data .dev-db-int`, every dev seed, `VIP_HOST=vip.localhost`, port 3030) driven by Playwright at 390 and 1440: sign-in → onboarding (follow + units) → dashboard → post with two photos + @mention (mention notification) → follow → DM with a photo (outsider 404, recipient 200) → six lessons + two module checks → certificate → workout + check-in → join a challenge → every award once in the history, balance exact → redeem a reward → partner portal purchase for that member (+5 pts/$) → admin redemption queue + statement preview → .global home / products / product / cart / checkout render with no clubhouse pieces. Axe WCAG 2.1 AA: 0 violations on 19 clubhouse pages at both widths; no console errors; 114/114 checks. Screenshots and the run log: `Downloads/VIP_Integration_screens/`.

### Decisions for James / Kevin

1. **Point amounts** — every default in the table above (rewards set purchases / referral / lesson / course / first post / event; academy the quiz 25; social the posting day 10; fitness workout 25, check-in 5, 7-day streak 100, program 500; the integration the challenge default 200). One page changes them.
2. **Live-session points** are paid when a member opens the Join link while the session is live — an honour system (there is no attendance list). Keep it, or set `vip.points.event` to 0.
3. **Monthly active streak** (in the plan, never built) was removed; say if Kevin wants it.
4. **Points expiry** (12 months inactive) touches every loyalty account, including .global non-members — read the cron's dry run before scheduling it, or set 0.
5. **Partner model** — rewards' seven assumptions above (net settlement, flat 5 pts/$, active members only, receipts + 24 h voids, 6-digit spend codes, 5% fee, Zelle settlement outside the app).
6. **Paid trainings** — the price of each course (points and/or a Zelle invoice) and which courses are purchase-only.
7. **Starter content to review** — 9 learning paths, *Reading the Research* (2 modules, 6 lessons, 2 checks) and 22 starter exercises; all written by the agents in the house voice, research literacy only (no dosing or human-use content).
8. **Uploaded content images are members-only** (signed-in members on .vip), not public on the internet; the public landing uses none of them.
9. **The order-detail PATCH paid path now also awards purchase points** on .global (keyed, so never twice). It still does not activate memberships — use *Mark paid* for membership invoices (unchanged).
10. **Units** default to imperial; the first-run flow asks.
11. Later, optional: drop the unused `vip_fitness_profiles.hideFromLeaderboards` column in a reviewed, non-additive migration.

## Quality (09-29)

`npx tsc --noEmit` exit 0 · `npm test` exit 0 (11 files, 105 tests, own throwaway PGlite DB) · `npm run verify:vip-migration` exit 0 · `npm run build` exit 0 · 20 hand-written mutants (credit spend/restore, unpaid expiry, reward eligibility/timing/defaults/idempotency, expiry replay, email claims, preference tokens, insert-only seed, copy guard) — all killed. Screenshots (desktop 1440 + 390 mobile) in `Downloads/VIP_Clubhouse_screens/`.

## Local development

```
npm run vip:dev-db                         # throwaway PGlite Postgres on 127.0.0.1:54329 (.vip-dev-db/)
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&pgbouncer=true&connection_limit=1"
npx prisma db push --skip-generate && npm run vip:seed-dev && npm run vip:seed-fitness-dev   # starter content + zz-*@example.invalid fakes
npm run dev   → http://localhost:3000/?__host=vip  (dev-only override; ?__host=global to leave)
# or production mode: VIP_HOST=vip.localhost, next build && next start → http://vip.localhost:3000
#   (do not pass -H/--hostname: the proxy's rewrite then targets that host, goes external and every .vip page 404s)
npm test      # refuses any non-127.0.0.1 DATABASE_URL; sendEmail/SMS are mocked
```

## What still needs Kevin (none of it blocks launch)

1. **Join links** for the three monthly events (Zoom, Meet — any https link) and whether the default days/times suit him.
2. **His logo files**, if he prefers his 09-21 "VP" PNGs to the monogram drawn here (commit them under `public/` and swap `Monogram`).
3. **A read of the copy and the three courses** — they are written in his voice about him ("Live Q&A with Kevin"); edit anything in the clubhouse admin.
4. **Reward amounts and expiry** — defaults are live settings; he can change them any day.
5. Still open from the research brief and **not** decided here: rights to the "VIP CONTENT" / "BEGINNING PEPS" material (Hacksmith-branded, human dosing — kept out entirely), and which contact address is canonical (vital@vitalityproject.global is used as Reply-To).
