# Booking Domain Foundation Implementation Plan

## Overview

We are building the minimal booking-domain foundation that future slices can consume without inventing their own data model or booking rules. The foundation will add the core booking schema, a status-based reservation model, atomic guardrails for capacity and duplicate prevention, a minimal seed fixture for local verification, and a narrow verification path. It will not add any booking UI or admin workflows yet.

## Current State Analysis

Auth and SSR are already in place, so this plan can assume cookie-based Supabase sessions and route protection from `src/lib/supabase.ts` and `src/middleware.ts`. The booking domain itself is absent: there are no classes, reservations, attendee, or availability tables or services yet, and the only API routes in `src/pages/api/` are auth handlers. Supabase migrations are enabled in `supabase/config.toml`, but no schema paths or seed file are wired, which means the data layer is ready for first migration work but not yet shaped for booking.

## Desired End State

After this plan lands, the repository will have a versioned booking schema for classes and reservations, a reservation model that preserves history through status changes rather than hard deletes, and a reusable domain helper that enforces the no-overbooking, no-duplicate, and no-post-start rules atomically. The local verification path will include a repeatable seed fixture and a targeted contract check so future slices can trust the foundation instead of re-deriving the rules.

### Key Discoveries:

- [src/middleware.ts](src/middleware.ts) already resolves the current user on every request and redirects guests away from protected routes.
- [src/lib/supabase.ts](src/lib/supabase.ts) already provides the SSR Supabase client used by auth handlers.
- [supabase/config.toml](supabase/config.toml) has migrations enabled (`schema_paths` is empty), and `sql_paths = ["./seed.sql"]` is already wired — the seed will be picked up automatically by `supabase db reset` once `supabase/seed.sql` is created.
- [src/pages/api/auth/signin.ts](src/pages/api/auth/signin.ts), [src/pages/api/auth/signup.ts](src/pages/api/auth/signup.ts), and [src/pages/api/auth/signout.ts](src/pages/api/auth/signout.ts) confirm that the API surface is still auth-only.

## What We're NOT Doing

- Booking UI, class browsing pages, or any client-facing reservation screens.
- Admin class management and attendee views.
- Cancellation flow FR-006 beyond leaving the schema ready for it later.
- Payments, memberships, or other non-goal scope.
- Deploy, infra, or observability changes.
- RLS policies for booking tables — explicitly deferred to a dedicated migration once F-02 (admin-access-foundation) lands, because admin-role policies depend on F-02's role column shape. A follow-up migration must add RLS before any booking tables are promoted to production.

## Implementation Approach

Start with the booking schema and encode the domain in the database so later slices can consume stable primitives. Use a status-based reservation model so cancellation can be added later without rewriting the schema. Keep the booking rule enforcement in a reusable helper or transaction-backed contract so the application layer can surface friendly errors while the database preserves correctness. Finish with a small seed fixture and a narrow verification loop that proves the foundation is solid without expanding the plan into user-facing work.

## Critical Implementation Details

The reservation write path must be atomic; UI-side checks are not enough because the PRD guardrails are correctness rules, not just UX rules. The schema should stay minimal but future-aware, so reservations keep history through status transitions rather than disappearing on cancellation. Seed data is only for repeatable local verification, and it should stay small enough that it does not become a second feature.

## Decisions

Canonical schema surface — downstream slice authors (S-02, S-03) should reference these names, not re-derive them from SQL:

**Table: `classes`**
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `text NOT NULL` | |
| `description` | `text` | nullable |
| `capacity` | `integer NOT NULL` | participant limit from FR-008 |
| `starts_at` | `timestamptz NOT NULL` | used for post-start-time guardrail |
| `created_at` | `timestamptz NOT NULL` | default `now()` |

**Table: `reservations`**
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `class_id` | `uuid NOT NULL` | FK → `classes.id` |
| `user_id` | `uuid NOT NULL` | FK → `auth.users.id` |
| `status` | `reservation_status NOT NULL` | enum: `confirmed`, `cancelled` |
| `created_at` | `timestamptz NOT NULL` | default `now()` |

Unique constraint: `(class_id, user_id)` on `reservations` where `status = 'confirmed'` — enforces the no-duplicate-booking guardrail at the DB level.

**Enum: `reservation_status`** values: `confirmed`, `cancelled`. Cancelled reservations are retained (status transition) rather than deleted — preserves history for FR-006.

**RPC function: `create_reservation(p_user_id uuid, p_class_id uuid)`** — defined in `supabase/migrations/`, exposed via Supabase RPC. Returns `jsonb` with `{ "ok": true }` on success or raises a named exception on failure (codes: `CLASS_FULL`, `ALREADY_RESERVED`, `CLASS_STARTED`).

## Phase 1: Define the booking schema

### Overview

Add the versioned database shape that represents classes and reservations, along with the constraints that future booking logic depends on.

### Scope

- Create the migration files for the booking domain using `supabase migration new <descriptive-name>` (this also creates `supabase/migrations/` if absent — the directory does not currently exist).
- Add the class and reservation records needed by the booking flow.
- Include indexes and uniqueness constraints that support fast lookups and duplicate prevention.
- Add a status-based shape for reservations so cancellation can be represented later without hard deletes.
- Add the minimal seed fixture at `supabase/seed.sql` (the path already configured in `config.toml`'s `sql_paths`; `supabase db reset` will pick it up automatically).

### Exit Criteria

- The booking schema exists in versioned SQL.
- The schema can be recreated from scratch locally.
- The seed fixture can be loaded during local reset.

### Risks

- If the schema is too sparse, future slices will need a second schema pass.
- If the seed is too ambitious, the foundation will start drifting into feature work.

## Phase 2: Implement the booking contract

### Overview

Add a reusable domain contract that enforces reservation rules atomically and exposes clear outcomes for future slices.

### Scope

- Implement the booking contract as a PostgreSQL function `create_reservation(p_user_id uuid, p_class_id uuid)` that checks capacity with `SELECT FOR UPDATE`, checks for duplicate reservations, checks class start time, and inserts the reservation — all within one transaction. Expose it via Supabase RPC.
- Map domain failures to explicit outcomes (using PostgreSQL `RAISE EXCEPTION` with named codes) that the API layer can translate into typed error responses for the UI.
- Keep the contract reusable so S-02 and S-03 call it via Supabase RPC without duplicating booking logic.
- Add the function definition to the booking schema migration (or a dedicated migration) in `supabase/migrations/`.

### Exit Criteria

- The booking rules are enforced by one shared contract.
- The contract returns clear success/failure outcomes for the guardrails in the PRD.
- The implementation does not require future slices to re-create the same booking logic.

### Risks

- A helper that is too thin will push logic back into future slices.
- A helper that is too heavy will blur the boundary between foundation and user-visible work.

## Phase 3: Verify and hand off

### Overview

Prove that the migration, seed, and contract work together and leave the foundation ready for the first user-facing slices.

### Scope

- Run a local database reset against the new schema and seed.
- Add a targeted contract check: a SQL script (or Vitest test calling Supabase RPC via the local instance) that calls `create_reservation` and asserts all four cases: success, `CLASS_FULL`, `ALREADY_RESERVED`, and `CLASS_STARTED`.
- Confirm that the resulting foundation is sufficient for S-02 and S-03 without additional schema work.
- Update the change metadata so the work is tracked as planned.

### Exit Criteria

- Local reset succeeds with the new booking schema.
- The booking contract passes its targeted check.
- The foundation is ready for downstream planning and implementation.

### Risks

- If verification is too manual, the foundation will be harder to trust in later changes.
- If verification expands too far, this change will stop being a foundation and become a feature slice.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Define the booking schema

#### Automated

- [ ] 1.1 Migration file created in supabase/migrations/
- [ ] 1.2 supabase db reset succeeds with booking schema

#### Manual

- [ ] 1.3 Seed fixture loads during local reset

### Phase 2: Implement the booking contract

#### Automated

- [ ] 2.1 Single booking contract enforces all three guardrails
- [ ] 2.2 Contract returns typed success/failure outcomes for each guardrail

#### Manual

- [ ] 2.3 No booking logic duplicated — S-02/S-03 can import the contract directly

### Phase 3: Verify and hand off

#### Automated

- [ ] 3.1 Local db reset succeeds with new booking schema
- [ ] 3.2 Targeted contract check passes

#### Manual

- [ ] 3.3 Foundation confirmed sufficient for S-02 and S-03 without additional schema work
