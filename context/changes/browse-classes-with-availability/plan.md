# Browse Classes With Availability Implementation Plan

## Overview

This change prepares and then implements roadmap slice S-03: clients can browse upcoming classes and view class details with available spots. This slice builds directly on the booking-domain foundation and is a dependency for S-02.

## Current State Analysis

- Booking schema and reservation contract exist in `supabase/migrations/20260630104321_booking_domain_foundation.sql`.
- RLS access foundation is in place for roles and table visibility.
- There are no class-browsing pages/routes yet under `src/pages/`.
- UI handoff for S-02/S-03 exists in `context/changes/booking-domain-foundation/handoff-note.md` and requires calm premium olive design.

## Desired End State

- Public route with upcoming classes list is available.
- Public route with class details (including available spots) is available.
- Availability is computed from `capacity - confirmed_reservations_count`.
- Started classes are excluded from list.
- UI follows `context/foundation/ui-design.md` and booking handoff constraints.

## What We're NOT Doing

- Creating reservation action flow (S-02).
- Reservation cancellation flow (FR-006).
- Manager/admin class management (S-04/S-05).

## Implementation Approach

Deliver in two phases:
1) data-access query surface for class list/details with availability,
2) Astro pages and components for browsing and class details.
Use server-side rendering and keep behavior read-only.

---

## Phase 1: Read model and query contracts

### Changes Required

1. `src/lib/` query module (new)
- Add server-side read helpers for:
  - upcoming classes list,
  - class details by id,
  - available spots calculation.

2. Shared typing
- Add explicit TS types for class list item and class details view model.

3. Error handling
- Normalize empty/missing class behavior for details route (404 state).

### Success Criteria

#### Automated

- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual

- Query helpers return only classes with `starts_at > now()`.
- Available spots are never negative and match DB state.

---

## Phase 2: Browse pages and UI

### Changes Required

1. `src/pages/classes/index.astro` (new)
- Render upcoming classes list with key metadata and availability badge.

2. `src/pages/classes/[id].astro` (new)
- Render class details with available spots and started/full states.

3. UI components (new or extended under `src/components/`)
- Reusable cards/badges for class status and availability.

4. Navigation affordance
- Add visible link entry-point from existing public/authenticated shell.

### Success Criteria

#### Automated

- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual

- Guest can open class list and detail pages.
- List excludes past/started classes.
- Detail view shows expected remaining spots.
- UI follows `context/foundation/ui-design.md` palette and spacing constraints.

---

## References

- `context/foundation/roadmap.md` (S-03)
- `context/foundation/prd.md` (FR-003, FR-004)
- `context/changes/booking-domain-foundation/handoff-note.md`
- `supabase/migrations/20260630104321_booking_domain_foundation.sql`
- `src/middleware.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Read model and query contracts

#### Automated

- [ ] 1.1 TypeScript compiles (`npx tsc --noEmit`)
- [ ] 1.2 Lint passes (`npm run lint`)

#### Manual

- [ ] 1.3 Upcoming classes query excludes started classes
- [ ] 1.4 Available spots formula matches DB values

### Phase 2: Browse pages and UI

#### Automated

- [ ] 2.1 TypeScript compiles after UI pages
- [ ] 2.2 Lint passes after UI pages

#### Manual

- [ ] 2.3 Guest can browse classes list
- [ ] 2.4 Guest can open class details
- [ ] 2.5 UI conforms to ui-design palette and spacing
