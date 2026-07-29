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

1. `src/lib/classes.handler.ts` (new)
- Add server-side read helpers:
  - `listUpcomingClasses(): Promise<{ ok: true; data: ClassListItem[] } | { ok: false; message: string }>`
    - Query contract: filter `starts_at > now()` and order `starts_at ASC`.
  - `getClassDetailsById(id: string): Promise<{ ok: true; data: ClassDetailsView } | { ok: false; reason: "not_found" | "query_failed"; message: string }>`
  - Pattern contract: keep the same discriminated-union style used in `src/lib/booking.handler.ts`.

2. `src/types.ts`
- Add explicit shared types:
  - `ClassListItem`
  - `ClassDetailsView`

3. `src/pages/classes/[id].astro` contract dependency
- Missing class must map to HTTP 404 and 404 page state based on `reason: "not_found"` from `getClassDetailsById`.
- Implementation contract: set `Astro.response.status = 404` when `reason` is `"not_found"`.
- Query failures must render a safe error state in the page (no runtime throw to client).

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
- Missing class id returns HTTP 404 with safe UI state.
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

- [x] 1.1 TypeScript compiles (`npx tsc --noEmit`) — pending commit
- [x] 1.2 Lint passes (`npm run lint`) — pending commit

#### Manual

- [ ] 1.3 Upcoming classes query excludes started classes
- [ ] 1.4 Available spots formula matches DB values

### Phase 2: Browse pages and UI

#### Automated

- [x] 2.1 TypeScript compiles after UI pages — pending commit
- [x] 2.2 Lint passes after UI pages — pending commit

#### Manual

- [ ] 2.3 Guest can browse classes list
- [ ] 2.4 Guest can open class details
- [ ] 2.5 UI conforms to ui-design palette and spacing
