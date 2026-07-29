<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Browse Classes With Availability

- Plan: context/changes/browse-classes-with-availability/plan.md
- Date: 2026-07-29
- Verdict: CHANGES_REQUESTED
- Findings: [0 critical] [2 warnings] [0 observations]

## Findings

### F1 — Plan success criteria contradict implemented schedule behavior

- Severity: WARNING
- Impact: MEDIUM
- Location: context/changes/browse-classes-with-availability/plan.md (Phase 1 Manual success criteria)
- Detail: The plan now defines a 7-day timetable that keeps started classes visible and unavailable, but the manual criterion still states `starts_at > now()`. This conflicts with the implemented SQL filter and expected UI behavior.
- Risk: Manual QA and future reviewers can mark the correct behavior as failure due to stale acceptance wording.
- Fix: Replace the criterion with "query helpers return classes in the 7-day timetable window (08:00-21:00) and started classes are marked unavailable." 

### F2 — Day/hour bucketing depends on server timezone, not viewer timezone

- Severity: WARNING
- Impact: MEDIUM
- Location: src/pages/classes/index.astro and supabase/migrations/20260729173000_classes_schedule_window.sql
- Detail: SQL day window and hour filter are computed in DB timezone, while frontend day/hour placement uses server-side `Date` conversion. In non-UTC deployments this can shift class cells by day/hour relative to user expectations.
- Risk: Classes may appear under the wrong day or hour when server/DB timezone differs from the intended product timezone.
- Fix: Normalize to one explicit timezone contract (e.g., UTC everywhere) or use a configured business timezone in both SQL windowing and Astro rendering.

## Checks Performed

- `npm run lint` ✅
- `npx tsc --noEmit` ✅
- Diff and runtime RPC sanity checks reviewed for list/detail behavior.
