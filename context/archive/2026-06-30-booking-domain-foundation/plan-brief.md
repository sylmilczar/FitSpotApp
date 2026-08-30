# Booking Domain Foundation - Plan Brief

## Goal
Create the minimal booking-domain foundation that future slices can reuse safely: schema, atomic guardrails, a status-based reservation model, and a small repeatable verification path.

## Current State
- Auth and SSR session handling already exist in `src/lib/supabase.ts` and `src/middleware.ts`.
- Booking tables, reservation rules, and attendee data do not exist yet.
- Supabase migrations are enabled (`schema_paths` is empty), and seed loading is already wired via `sql_paths = ["./seed.sql"]`; only the booking schema and `supabase/seed.sql` file are missing.

## Approach
1. Add the booking schema and constraints.
2. Implement a reusable PostgreSQL `create_reservation` contract exposed via Supabase RPC that enforces capacity, duplicate, and start-time rules atomically.
3. Add a minimal seed fixture and a targeted verification loop.
4. Defer booking-table RLS policies to a follow-up migration after F-02 defines role-based policy shape (client/manager/admin).

## Out of Scope
- Booking UI.
- Manager/admin flows.
- Cancellation implementation for FR-006.
- Deploy, infra, or observability work.

## Done When
- The schema can be recreated locally.
- The booking contract enforces the PRD guardrails.
- A local reset plus targeted check proves the foundation is stable.
