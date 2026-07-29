# Admin Access Foundation — Plan Brief

> Full plan: `context/changes/admin-access-foundation/plan.md`

## What & Why

The `booking-domain-foundation` deliberately deferred all Row Level Security to this change. Without an access contract in place, the booking tables are wide open and no downstream slice can be built safely. This change locks the tables down: it introduces a minimal role model (`client` / `manager` / `admin`), enables RLS with granular per-role policies, and exposes management roles server-side in the Astro middleware.

## Starting Point

`classes` and `reservations` tables exist with no RLS. `create_reservation()` grants execute to `anon`. `context.locals.user` carries only a raw Supabase user object with no role. No profiles table, no role enum, no admin route protection exists anywhere.

## Desired End State

Every new user automatically gets a `client` profile row on signup. A manager or admin can be promoted via a SQL update. RLS on both tables enforces the PRD access model: public class schedule, own-only reservation reads for clients, all-reservation reads for managers and admins, manager or admin class writes. The Astro middleware resolves `context.locals.role` on every request and blocks non-admins from the `/admin` route prefix. S-04 can build admin pages without implementing access control itself.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Role storage | `profiles` table with `app_role` enum | Standard Supabase pattern; queryable in SQL; no JWT claim plumbing needed | Plan |
| Role values | `client`, `manager`, and `admin` | `guest` is unauthenticated — not a stored role; `admin` is a superset of `manager` | Plan |
| Default signup role | `client` (auto via trigger) | Single-club trusted model; every registered user should be able to book | Plan |
| Admin promotion | SQL update via seed.sql (local) + Supabase SQL Editor (prod) | No API surface needed for a single-club MVP with one admin | Plan |
| RLS scope | Both `classes` and `reservations` in one migration | Booking-domain-foundation deferred both; they must land together | Plan |
| Middleware check | `context.locals.role` via profiles lookup per request | Consistent availability across all Astro pages; one clear pattern | Plan |
| Admin route wiring | `/admin` prefix guard added to middleware now | S-04 gets protection by default without remembering to add it | Plan |
| `create_reservation` grant | Revoke `anon` | Principle of least privilege; function is SECURITY DEFINER so no RLS INSERT policy needed | Plan |

## Scope

**In scope:**
- `app_role` enum + `profiles` table + signup trigger
- `get_my_role()` SECURITY DEFINER helper
- RLS policies on `classes` and `reservations`
- Revoke `anon` from `create_reservation()`
- `context.locals.role` in middleware + `App.Locals` type update
- `/admin` route guard in middleware
- `AppRole` type in `src/types.ts`
- Local admin seed documentation
- S-04 handoff note

**Out of scope:**
- Admin UI pages (S-04)
- Reservation cancellation RLS UPDATE policy (FR-006 / S-02)
- JWT custom claims / Supabase Auth hooks
- Any booking logic changes

## Architecture / Approach

Two SQL migrations in sequence: first the role schema (profiles, trigger, helper), then the RLS policies (which depend on `get_my_role()`). The application layer (middleware + types) follows. The `create_reservation()` function is `SECURITY DEFINER` and bypasses RLS for its INSERT path — this is intentional; only SELECT paths need client-facing RLS policies.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Role schema | profiles table, signup trigger, get_my_role(), AppRole type | Trigger must fire on auth.users INSERT — Supabase trigger on auth schema requires care |
| 2. RLS policies | RLS enabled on classes + reservations, per-role policies, anon grant revoked | Policy logic bugs are silent — manual role-switching tests are required |
| 3. Application layer | context.locals.role in middleware, /admin guard, env.d.ts updated | Extra DB query per request — acceptable for MVP traffic |
| 4. Verify and hand off | Full db reset, end-to-end access flow verified, S-04 handoff note | Nothing ships to downstream slices without this gate |

**Prerequisites:** `booking-domain-foundation` fully applied (`classes` and `reservations` tables must exist)
**Estimated effort:** ~1 session across 4 phases

## Open Risks & Assumptions

- Trigger on `auth.users` INSERT requires `SECURITY DEFINER` and careful `search_path` — same pattern as `handle_new_user()` used in many Supabase starter projects.
- RLS SELECT policies on `reservations` use `get_my_role()` which does a profiles lookup — if the profiles row is missing for some reason, the manager/admin SELECT-all policy fails silently (returns no rows). The trigger + `ON CONFLICT DO NOTHING` guard should prevent this.
- The `/admin` route guard has no real pages to test against until S-04 ships — manual verification must use redirect behavior on a non-existent route.

## Success Criteria (Summary)

- `npx supabase db reset` completes cleanly with all migrations and seed applied.
- A client user cannot write to `classes` and sees only their own reservations.
- A manager or admin user can read all reservations and write to `classes`.
- Visiting `/admin` as a client redirects to `/dashboard`; as unauthenticated redirects to `/auth/signin`.
