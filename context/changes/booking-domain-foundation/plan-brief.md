# Booking Domain Foundation - Plan Brief

## Goal
Create the minimal booking-domain foundation that future slices can reuse safely: schema, atomic guardrails, a status-based reservation model, and a small repeatable verification path.

## Current State
- Auth and SSR session handling already exist in `src/lib/supabase.ts` and `src/middleware.ts`.
- Booking tables, reservation rules, and attendee data do not exist yet.
- Supabase migrations are enabled, but there is no booking schema or seed file wired in `supabase/config.toml`.

## Approach
1. Add the booking schema and constraints.
2. Implement a reusable booking contract that enforces capacity, duplicate, and start-time rules atomically.
3. Add a minimal seed fixture and a targeted verification loop.

## Out of Scope
- Booking UI.
- Admin flows.
- Cancellation implementation for FR-006.
- Deploy, infra, or observability work.

## Done When
- The schema can be recreated locally.
- The booking contract enforces the PRD guardrails.
- A local reset plus targeted check proves the foundation is stable.
