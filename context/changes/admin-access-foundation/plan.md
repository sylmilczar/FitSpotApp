# Admin Access Foundation Implementation Plan

## Overview

We are building the minimal admin-access foundation that defines the user role model, Row Level Security policies on the booking tables, and server-side role awareness in the Astro middleware. This change fulfills the explicit RLS deferral in `booking-domain-foundation` and establishes the access contract that S-02 (reserve class with guardrails) and S-04 (admin manage classes and attendees) depend on.

## Current State Analysis

- `classes` and `reservations` tables exist in `supabase/migrations/20260630104321_booking_domain_foundation.sql` with no RLS enabled — the migration carries a comment: `"RLS is intentionally deferred to a follow-up migration after F-02"`.
- `create_reservation()` RPC grants `execute` to `anon, authenticated, service_role` — the `anon` grant is overly broad.
- No `profiles` table, no role enum, no role infrastructure anywhere in the codebase.
- `context.locals.user` in `src/env.d.ts` is a raw Supabase `User` with no role field.
- `src/middleware.ts` checks only for presence of a user, not for role.
- No admin routes exist yet — S-04 will add them.

## Desired End State

After this plan lands, the repository will have a `profiles` table holding each user's application role (`client`, `manager`, or `admin`), a signup trigger that auto-assigns `client` to every new user, a `get_my_role()` security-definer helper enabling clean RLS policies, RLS enabled on `classes` and `reservations` with per-role, per-operation policies, and an Astro middleware that resolves the current user's role and guards the `/admin` route prefix. Downstream slices (S-02, S-04) can trust the access contract without re-implementing role checks.

### Key Discoveries

- `src/middleware.ts` already resolves `context.locals.user` — a parallel `context.locals.role` field follows the same pattern.
- `src/env.d.ts` defines `App.Locals` — it needs a `role` field added.
- `create_reservation()` is `SECURITY DEFINER` (bypasses RLS for INSERTs) — so no INSERT policy is needed on `reservations` for the RPC path; only SELECT policies are needed for read paths.
- `context/foundation/ui-design.md` must be followed by downstream admin UI slices (S-04); this foundation change documents that expectation in the handoff note.

## What We're NOT Doing

- Admin UI (class creation/edit/delete pages, attendee view) — that is S-04.
- User management routes and operations (admin-only) — deferred to a dedicated future slice.
- Reservation cancellation policy — status-update RLS (UPDATE policy on `reservations`) deferred to the cancellation slice (FR-006 / S-02).
- Payments, memberships, multi-club, or mobile — PRD non-goals.
- JWT custom claims / Supabase Auth hooks — over-engineered for MVP free-tier deployment.
- Any changes to the booking contract (`create_reservation`) beyond revoking the `anon` grant.

## Implementation Approach

Ship two SQL migrations: one for the role schema (profiles table, trigger, helper function) and one for RLS policies (enabling RLS and adding policies to both tables). Then update the application layer (middleware + types) to expose role server-side. Finish with a verification pass and a handoff note for S-04. The two-migration split keeps each migration single-purpose and independently reversible.

## Decisions

**`app_role` enum**: `('client', 'manager', 'admin')` — `guest` is not a stored role; unauthenticated users are guests by definition. `admin` is a superset of `manager`. Admin-only user-management behaviors are explicitly deferred to a future slice.

**Default role on signup**: `client` — auto-assigned by trigger. Any user who registers can book; admin is an explicit promotion.

**Admin promotion**: SQL update in `supabase/seed.sql` for local dev; Supabase SQL Editor for production.

**`get_my_role()` helper**: A `SECURITY DEFINER` SQL function that queries `profiles` for `auth.uid()`. Used in RLS policies to avoid referencing `profiles` directly (which would create a self-referencing RLS check on the profiles table itself).

**RLS policy design**:
- `classes`: anon + authenticated SELECT (public schedule); manager or admin INSERT, UPDATE, DELETE.
- `reservations`: authenticated SELECT own rows; manager or admin SELECT all; INSERT handled by SECURITY DEFINER RPC (no direct INSERT policy needed for clients).

**Middleware**: `context.locals.role` is populated by a single `profiles` lookup immediately after `getUser()`. Null if the user has no profile (should not happen after trigger is in place, but defensive).

---

## Phase 1: Role schema

### Overview

Create the `app_role` enum, the `profiles` table, the signup trigger that auto-assigns `client`, and the `get_my_role()` SECURITY DEFINER helper function that RLS policies will use. Update seed.sql with a local admin seed comment. Add `AppRole` to `src/types.ts`.

### Changes Required

#### 1. Migration — profiles and role schema

**File**: `supabase/migrations/<timestamp>_admin_access_profiles.sql`

**Intent**: Create the user role infrastructure. The `profiles` table stores the application role for every authenticated user. The trigger fires on every `auth.users` INSERT so new signups get a `client` profile automatically. The `get_my_role()` helper is `SECURITY DEFINER` so RLS policies can call it without triggering an infinite recursive check on the profiles table.

**Contract**:
- Enum `public.app_role`: values `'client'`, `'manager'`, `'admin'`.
- Table `public.profiles`: `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `role public.app_role NOT NULL DEFAULT 'client'`, `created_at timestamptz NOT NULL DEFAULT now()`.
- Function `public.handle_new_user()`: `RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER` — inserts `(NEW.id, 'client')` into profiles on conflict do nothing.
- Trigger `on_auth_user_created` on `auth.users` AFTER INSERT FOR EACH ROW.
- Function `public.get_my_role() RETURNS text LANGUAGE sql SECURITY DEFINER STABLE` — returns `role::text` from `profiles` where `user_id = auth.uid()`.
- Grant SELECT on `profiles` to `authenticated`.
- Grant EXECUTE on `get_my_role()` to `authenticated`, `anon`.

#### 2. seed.sql — local admin seed

**File**: `supabase/seed.sql`

**Intent**: Document the local admin promotion pattern so developers can quickly set up an admin account after `supabase db reset`. The seed should show the SQL to promote an existing user to admin by email (run after creating the user via Supabase Studio or CLI).

**Contract**: Append a clearly-labeled comment block with the promotion SQL snippet. Do not hard-code a specific email or UUID — the snippet is a template, not a data row.

#### 3. src/types.ts — AppRole type

**File**: `src/types.ts`

**Intent**: Export the TypeScript representation of the role enum so middleware and pages can reference it without string literals.

**Contract**: Add `export type AppRole = 'client' | 'manager' | 'admin';` alongside existing booking types.

### Success Criteria

#### Automated Verification

- Migration creates profiles table and trigger: `npx supabase db reset` succeeds with no errors
- `get_my_role()` function exists: `npx supabase db diff --schema public` shows function in schema
- TypeScript compiles with new AppRole type: `npm run build` or `npx tsc --noEmit`

#### Manual Verification

- After `supabase db reset`, manually creating a user (via Supabase Studio) auto-creates a `client` profile row in `public.profiles`
- `select * from public.profiles` shows the seeded row

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the trigger works before proceeding to Phase 2.

---

## Phase 2: RLS policies

### Overview

Enable Row Level Security on `classes` and `reservations` and add granular per-role, per-operation policies. Revoke `anon` from `create_reservation()` as part of the same migration. This makes the booking tables production-safe.

### Changes Required

#### 1. Migration — RLS policies

**File**: `supabase/migrations/<timestamp>_admin_access_rls.sql`

**Intent**: Enable RLS on both booking tables and add the minimum set of policies that correctly reflect the PRD access model. Tighten the `create_reservation` grant as part of this migration since it logically belongs to the access hardening step.

**Contract**:

```
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
```

Policies for `classes`:
- `classes_select_all` — FOR SELECT TO anon, authenticated USING (true) — public class schedule
- `classes_manager_insert` — FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('manager', 'admin'))
- `classes_manager_update` — FOR UPDATE TO authenticated USING (public.get_my_role() IN ('manager', 'admin')) WITH CHECK (public.get_my_role() IN ('manager', 'admin'))
- `classes_manager_delete` — FOR DELETE TO authenticated USING (public.get_my_role() IN ('manager', 'admin'))

Policies for `reservations`:
- `reservations_select_own` — FOR SELECT TO authenticated USING (user_id = auth.uid())
- `reservations_select_manager` — FOR SELECT TO authenticated USING (public.get_my_role() IN ('manager', 'admin'))

Grant revision:
- `REVOKE EXECUTE ON FUNCTION public.create_reservation(uuid, uuid) FROM anon;`

### Success Criteria

#### Automated Verification

- `npx supabase db reset` succeeds with RLS migration applied
- `SELECT relrowsecurity FROM pg_class WHERE relname = 'classes'` returns `true`
- `SELECT relrowsecurity FROM pg_class WHERE relname = 'reservations'` returns `true`

#### Manual Verification

- Anon request to SELECT from `classes` returns rows (public schedule readable)
- Authenticated client request to SELECT from `reservations` returns only their own rows
- Authenticated manager or admin request to SELECT from `reservations` returns all rows
- Attempting to INSERT into `classes` as `authenticated` (client role) is rejected by RLS
- `SELECT has_function_privilege('anon', 'public.create_reservation(uuid, uuid)', 'EXECUTE')` returns `false`

**Implementation Note**: RLS policy testing is most reliable via the Supabase SQL Editor using `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" = '...'` to impersonate roles. After manual verification passes, proceed to Phase 3.

---

## Phase 3: Application layer

### Overview

Update the Astro middleware to resolve the current user's role from `profiles` on every request and expose it as `context.locals.role`. Update `src/env.d.ts` to type the new field. Add an `ADMIN_ROUTES` guard that redirects non-admin users away from the `/admin` prefix.

### Changes Required

#### 1. src/env.d.ts — Add role to App.Locals

**File**: `src/env.d.ts`

**Intent**: Extend the `App.Locals` interface so all Astro pages and API routes can read `context.locals.role` with proper TypeScript types.

**Contract**: Add `role: import('@/types').AppRole | null;` to the `Locals` interface.

#### 2. src/middleware.ts — Profile lookup and admin guard

**File**: `src/middleware.ts`

**Intent**: After resolving the user, fetch the user's profile row from `profiles` to get the role. Expose as `context.locals.role`. Add an `ADMIN_ROUTES` constant (initially `['/admin']`) that redirects non-admin authenticated users to the dashboard and redirects unauthenticated users to sign-in.

**Contract**:
- After `supabase.auth.getUser()`, if `user` is non-null: query `profiles` for `user.id`, set `context.locals.role` to the `role` field or `null` on no-row.
- If `user` is null: `context.locals.role = null`.
- `ADMIN_ROUTES` constant: `['/admin']`.
- Admin route check (after existing `PROTECTED_ROUTES` check): if pathname starts with an admin route prefix AND role is not `'admin'` or `'manager'`, redirect to `/dashboard` (authenticated client without management role) or `/auth/signin` (unauthenticated).

### Success Criteria

#### Automated Verification

- TypeScript compiles with updated `App.Locals`: `npx tsc --noEmit`
- Lint passes: `npm run lint`

#### Manual Verification

- Visiting `/admin` while signed in as a client redirects to `/dashboard`
- Visiting `/admin` while signed in as an admin or manager serves the route (or 404 if no page exists yet — the guard passes)
- Visiting `/admin` while unauthenticated redirects to `/auth/signin`
- `context.locals.role` resolves to `'client'` for a regular user and `'manager'`/`'admin'` for promoted users

**Implementation Note**: The `/admin` prefix has no pages until S-04. The guard will effectively be untested against real admin pages until then — manual verification should use a temporary `/admin` test page or confirm redirect behavior on a non-existent route.

---

## Phase 4: Verify and hand off

### Overview

Run a full local reset, verify the end-to-end access model works, and write a handoff note for S-04 (admin class management) covering what the access contract provides and what UI rules apply.

### Changes Required

#### 1. Handoff note for S-04

**File**: `context/changes/admin-access-foundation/handoff-note.md`

**Intent**: Document the access contract surface for S-04 so the admin slice knows what database-level guarantees it can rely on and what visual design system to follow.

**Contract**: Cover: `profiles` table structure and promotion pattern, `get_my_role()` helper, RLS guarantees per table, admin route guard behavior, and a pointer to `context/foundation/ui-design.md` for the calm premium visual language the admin UI must follow.

### Success Criteria

#### Automated Verification

- `npx supabase db reset` succeeds end-to-end with all migrations and seed
- `npm run lint` passes
- `npx tsc --noEmit` passes

#### Manual Verification

- Full management-role access flow verified: create user → auto-profile → promote to manager/admin → `/admin` route guard passes
- Client user access flow verified: client cannot access `/admin`, cannot write to `classes`, can only see own reservations
- Handoff note clearly covers what S-04 can rely on and references `context/foundation/ui-design.md`

---

## Testing Strategy

### Manual Testing Steps

1. `npx supabase db reset` — clean slate with all migrations
2. Create a test user via Supabase Studio → verify profile row appears with `role = 'client'`
3. Promote the user: `UPDATE public.profiles SET role = 'admin' WHERE user_id = '<id>'`
4. Sign in as promoted users → verify `context.locals.role` is `'manager'` and `'admin'` respectively
5. Sign in as a regular client → verify `/admin` redirects to `/dashboard`
6. Verify `SELECT` on `classes` works for anon
7. Verify `INSERT` into `classes` as client returns RLS error
8. Verify `SELECT` on `reservations` as client returns only own rows
9. Promote another user to `manager` and verify `/admin` route guard passes for that user
10. Verify `SELECT` on `reservations` as manager returns all rows
11. Verify `SELECT` on `reservations` as admin returns all rows

## Migration Notes

Two migrations will be created in sequence. The `profiles` migration must apply before the `RLS policies` migration (RLS policies reference `get_my_role()` which is defined in the profiles migration). Both land before any booking UI slices (S-02, S-03, S-04) run.

The `create_reservation()` function is `SECURITY DEFINER` and bypasses RLS for its INSERT path — this is intentional and correct. The RLS policies only need to cover SELECT paths for client self-read and manager/admin broader reads.

## References

- Booking domain schema: `supabase/migrations/20260630104321_booking_domain_foundation.sql`
- PRD Access Control section: `context/foundation/prd.md`
- Roadmap F-02: `context/foundation/roadmap.md`
- UI design system for downstream admin UI: `context/foundation/ui-design.md`
- Booking handoff note (F-01): `context/changes/booking-domain-foundation/handoff-note.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Role schema

#### Automated

- [x] 1.1 Migration creates profiles table and trigger: supabase db reset succeeds — db41868
- [x] 1.2 get_my_role() function exists in schema — db41868
- [x] 1.3 TypeScript compiles with new AppRole type — db41868

#### Manual

- [x] 1.4 Trigger auto-creates client profile row on new user creation — db41868
- [x] 1.5 select * from public.profiles shows seeded row — db41868

### Phase 2: RLS policies

#### Automated

- [x] 2.1 supabase db reset succeeds with RLS migration applied — ddf704d
- [x] 2.2 RLS enabled on classes table — ddf704d
- [x] 2.3 RLS enabled on reservations table — ddf704d

#### Manual

- [x] 2.4 Anon SELECT on classes returns rows — ddf704d
- [x] 2.5 Client SELECT on reservations returns only own rows — ddf704d
- [x] 2.6 Manager or admin SELECT on reservations returns all rows — ddf704d
- [x] 2.7 Client INSERT on classes is rejected by RLS — ddf704d
- [x] 2.8 anon no longer has EXECUTE on create_reservation — ddf704d

### Phase 3: Application layer

#### Automated

- [x] 3.1 TypeScript compiles with updated App.Locals — 7f34e94
- [x] 3.2 Lint passes — 7f34e94

#### Manual

- [x] 3.3 /admin redirects client to /dashboard — 7f34e94
- [x] 3.4 /admin passes for admin or manager role — 7f34e94
- [x] 3.5 /admin redirects unauthenticated to /auth/signin — 7f34e94
- [x] 3.6 context.locals.role resolves for regular and promoted user — 7f34e94

### Phase 4: Verify and hand off

#### Automated

- [x] 4.1 supabase db reset succeeds end-to-end — 04406a4
- [x] 4.2 npm run lint passes — 003b7ae
- [x] 4.3 npx tsc --noEmit passes — 003b7ae

#### Manual

- [x] 4.4 Full admin access flow verified end-to-end
- [x] 4.5 Client access flow verified end-to-end
- [x] 4.6 Handoff note covers S-04 contract and references ui-design.md — 003b7ae
