# vitalityproject.vip — members' clubhouse

Branch `feat/vip-clubhouse`. It is **local only**: nothing has been pushed, deployed, or run against the production DB.

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
- **Rewards.** An admin sets a monthly store-credit amount per tier (`VipTierReward`, default **0 = off**). The `VIP member rewards` cron deposits it into the existing `StoreCredit`/`StoreCreditTxn` ledger as type `MEMBER_REWARD`. Each member can receive it once per UTC month, enforced by `UNIQUE(userId, period)` with the insert done `ON CONFLICT DO NOTHING` in the same transaction as the credit. The store's card checkout already spends that ledger (`useStoreCredit`). The member discount and free shipping already apply at .global checkout from the membership tier, with no change needed.

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
| `CRON_SECRET` | existing | Also protects `/api/cron/vip-member-rewards`. |

`NEXTAUTH_COOKIE_DOMAIN`, if it is set in production, still applies only to .global cookies. The clubhouse cookie never sets a Domain.

## Migration

- File: `prisma/migrations-manual/001_vip_clubhouse.sql`. It is additive, and running it twice changes nothing. It adds one enum value (`CreditTxType.MEMBER_REWARD`) and new `vip_*` tables, indexes, and foreign keys. It does not ALTER or UPDATE anything that already exists.
- Proof: `npm run verify:vip-migration` pushes origin/master's schema into a throwaway PGlite DB and applies the SQL **twice**. It then checks that `prisma migrate diff` against `schema.prisma` is empty.
- **Apply order:** (1) back up Neon (see BACKUP_DR.md), (2) `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations-manual/001_vip_clubhouse.sql`, (3) deploy the app. The deploy workflow's `prisma db push` then finds nothing to change. If step 2 is skipped, that `db push` creates the same objects, because they are all additive.

## Deploy steps (describe only — none executed)

1. Review and merge `feat/vip-clubhouse` → `master`. **A push to master auto-deploys** through `.github/workflows/deploy.yml`.
2. Before merging, on the box (`/opt/vitality`, Hetzner, SSH port 2222), make these changes:
   - add `VIP_HOST`, `VIP_SSO_SECRET` (generate a new value on the box), and `NEXT_PUBLIC_VIP_URL` to `.env.production`
   - `mkdir -p /opt/vitality/private-uploads && chown 1001:1001 /opt/vitality/private-uploads`. The container runs as uid 1001. docker-compose now bind-mounts it at `/app/private-uploads`.
3. Apply the migration as described in the Migration section.
4. Merge. The workflow runs `db push`, then `up -d --build app`.
5. Add a daily crontab line next to the existing six jobs. Run it first with `&dryRun=1`:
   `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vitalityproject.global/api/cron/vip-member-rewards`
   It grants nothing while every tier is $0.
6. nginx needs **no change**. `server_name _` already proxies any Host with `proxy_set_header Host $host`.
7. Smoke test: open `https://vitalityproject.vip/` and confirm the landing page has an `x-robots-tag` header. Go to `/feed` and confirm it redirects to `/signin`. Sign in as a real member and confirm the feed loads. Open `/clubhouse` on .global and confirm it lands on the .vip feed.

## DNS for vitalityproject.vip (Cloudflare zone, currently no records)

- `A  vitalityproject.vip  → 178.104.155.129`, **proxied** (orange cloud).
- `CNAME  www  → vitalityproject.vip`, proxied.
- SSL/TLS mode must match .global's zone. The origin nginx listens on **:80 only**, so .global presumably runs Flexible. Set .vip the same way, or add an origin certificate plus a 443 server block before using Full.
- The box firewall and Cloudflare rules must allow the new hostname in the same way as .global.

## Local development

```
npm run vip:dev-db                         # throwaway PGlite Postgres on 127.0.0.1:54329 (.vip-dev-db/)
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&pgbouncer=true&connection_limit=1"
npx prisma db push --skip-generate && npm run vip:seed-dev   # zz-*@example.invalid fakes
npm run dev   → http://localhost:3000/?__host=vip  (dev-only override; ?__host=global to leave)
# or production mode: VIP_HOST=vip.localhost, next build && next start → http://vip.localhost:3000
npm test      # 65 tests on their own throwaway DB; refuses any non-127.0.0.1 DATABASE_URL
```

## Open questions for Kevin / Edward

1. **The live Zelle checkout does not spend store credit.** Only `api/checkout`, the card path, honours `useStoreCredit`, and that path stays inert until Chase keys arrive. `api/checkout-zelle` ignores the ledger. Monthly rewards would build up but could not be spent on the path customers use today. Should the Zelle checkout debit credit at order time, and what happens to that credit if the Zelle order is cancelled? This is a business rule, so it was not built.
2. **Reward amounts per tier.** No source defines them, so all are $0 (off). Other open points:
   - Should the reward be dollars of store credit, or Kevin's "peptide coupons"?
   - Who funds it?
   - Does it stack with the member discount?
3. **Tier ladder.** The live tiers are Club $25 / Plus $150 / Premium Stacks $250, with 5/10/15% discounts. Kevin's 06-23 emails proposed 10/15/20% and the names Vital Member / Performance / Elite. The clubhouse shows the live values.
4. **Grant timing.** Rewards are granted per calendar month (UTC), not per billing cycle. Should a member who is suspended from the community still get rewards? Currently yes: rewards follow membership status only.
5. **All landing and descriptive copy.** The slots are in `src/lib/vip/copy.ts` and render as visible "Copy needed" boxes.
6. **Logo.** Kevin's 09-21 "VP" PNGs are email attachments and are not in the repo, so a text wordmark stands in for now.
7. **Course content.** Nothing is seeded. Kevin's "VIP CONTENT" and "BEGINNING PEPS" docs name another brand (Hacksmith's Peptalk) and include human dosing. Rights and counsel need to be resolved before anything like them is entered.
8. **Mint-side CTA text on .global.** The merged `feat/vip-sso-handoff` adds a card to `/account/membership` for ACTIVE members: "Your VIP Clubhouse / Community, training & rewards — members only." That copy was written by a previous agent and is **visible on .global**. Edward should approve or rewrite it.
9. **Migrating current .global members.** Do existing members migrate, and does .global keep selling memberships? Joining currently hands off to `.global/membership`.
10. **Ownership.** Who owns .vip versus .global? The brief calls .global a "partner", while memory says Edward owns .vip.
11. **Live Q&A host.** Events take any https join link. Which video platform should be used?
12. **Moderation defaults** (technical, adjustable): 5 posts / 10 min, 20 comments / 10 min, 5 links per post, 10-minute duplicate check, 12 MB images.
