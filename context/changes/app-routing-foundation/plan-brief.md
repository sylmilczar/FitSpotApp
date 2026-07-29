# App Routing Foundation — Plan Brief

> Full plan: `context/changes/app-routing-foundation/plan.md`

## What & Why

We are introducing a coherent routing foundation for FitSpot MVP: `/` is the public home entrypoint, users can move into auth or classes, and login returns users to the page context they came from. This removes product dependence on `/dashboard` and aligns routing with the intended booking-first journey.

## Starting Point

Current routing hardcodes `/dashboard` as the authenticated destination in middleware and sign-in API flow. Navigation still exposes dashboard directly, which conflicts with the desired `home -> auth/classes` path.

## Desired End State

Guests always start at a public, informative homepage and can choose auth or class browsing. Authenticated users who hit auth pages are redirected via safe return-to logic (or fallback `/classes`). Dashboard is no longer required in runtime flow.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Post-login redirect | Return to origin context (safe returnTo), fallback `/classes` | Preserves user intent and avoids forcing a single landing page for all sessions | Plan |
| Auth-page guard behavior | Use returnTo if present, else `/classes` | Keeps deep-link UX while preserving safe booking-first fallback | Plan |
| Dashboard policy | Remove dashboard route from active app | Product flow no longer depends on dashboard and should stay consistent | Plan |
| Homepage scope | Lean MVP content (who we are + contact + CTAs) | Delivers required routing narrative quickly without over-expanding marketing scope | Plan |
| Error fallback after redirect | Keep existing `/classes` error state | Already safe and sufficient; avoids extra routing complexity in F-03 | Plan |

## Scope

**In scope:**
- Central routing utility for redirect constants and returnTo sanitization
- Middleware/auth redirect refactor away from dashboard
- Homepage alignment to public entrypoint role
- Topbar cleanup (classes-first, no dashboard)
- Auth page/form returnTo propagation
- Removal of `/dashboard` route from runtime

**Out of scope:**
- Role-based custom landing per admin/manager
- Booking/reservation domain changes
- Manager/admin route redesign

## Architecture / Approach

Use one route contract module consumed by middleware and auth API handlers. The auth pages propagate optional `returnTo`, sign-in submits it, and server-side sanitizer enforces internal-path-only redirect targets. UI navigation is then aligned to classes-first flow and obsolete dashboard route is removed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Routing Contract and Redirect Rules | Unified redirect logic + safe returnTo behavior in middleware/API | Open-redirect or inconsistent fallback behavior if sanitizer is incomplete |
| 2. Public Homepage and Navigation Contract | Public home alignment and dashboard removal from nav/runtime | Accidental broken legacy links if stale references remain |
| 3. Auth Page Return-To Propagation | End-to-end returnTo persistence through auth UI and sign-in | Losing context between signin/signup transitions |

**Prerequisites:** S-01 complete (already done), existing auth middleware operational
**Estimated effort:** ~2-3 implementation sessions across 3 phases

## Open Risks & Assumptions

- Existing users may still have bookmarks to `/dashboard`; removing route must avoid confusing dead-ends.
- Return-to sanitization must strictly reject external targets.
- Auth-to-classes fallback assumes `/classes` stays public and stable.

## Success Criteria (Summary)

- Guest lands on `/` and can navigate directly to auth or classes.
- Sign-in returns users to origin context when safe, otherwise to `/classes`.
- `/dashboard` no longer drives any core routing or navigation path.
