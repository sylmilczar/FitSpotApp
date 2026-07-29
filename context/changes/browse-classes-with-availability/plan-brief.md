# Plan Brief: browse-classes-with-availability

## Goal
Deliver S-03 so clients can browse upcoming classes and view details with available spots.

## Scope
- Add server-side read model/query helpers for upcoming classes and class details.
- Add browse pages (`/classes`, `/classes/[id]`) with availability UI.
- Keep feature read-only (no reservation actions in this change).

## Key Constraints
- Must follow `context/foundation/ui-design.md` and S-02/S-03 handoff note.
- Must use SSR Astro pages.
- Must rely on existing booking domain schema and RLS setup.

## Verification
- Automated: `npx tsc --noEmit`, `npm run lint`
- Manual: browse/list/details/availability checks from `plan.md`

## Out of Scope
- Reservation creation/cancellation (S-02 / FR-006)
- Manager/admin operations (S-04, S-05)
