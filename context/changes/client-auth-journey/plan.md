# Client Auth Journey Implementation Plan

## Overview

This change implements roadmap slice S-01 (`client-auth-journey`) first, before S-04, to align delivery order with dependencies and the speed-oriented MVP path. The goal is to ensure a client can sign up, sign in, and immediately enter a protected app flow.

## Current State Analysis

- Auth pages and forms already exist for signup/signin.
- API handlers exist for `/api/auth/signup`, `/api/auth/signin`, `/api/auth/signout`.
- Middleware already protects `/dashboard` and redirects unauthenticated requests to `/auth/signin`.
- Gap: successful signin currently redirects to `/` instead of protected entry route.
- Gap: auth API payload validation is mostly client-side; server-side validation should enforce contract.

## Desired End State

- Successful signin redirects to `/dashboard` (protected entry point for now).
- Signup and signin API routes validate input server-side using Zod.
- Signup route validates confirm-password parity server-side.
- Auth pages redirect authenticated users away from signup/signin to `/dashboard`.
- S-01 checklist is verified and tracked in Progress with commit SHAs.

## What We're NOT Doing

- Booking classes list/details UI (S-03).
- Reservation flow and guardrails (S-02).
- Manager/admin operations UI (S-04/S-05).

## Implementation Approach

Apply minimal high-confidence changes in auth pages and auth API handlers. Keep middleware-based route protection as the source of truth for access control. Verify with lint/type checks and manual login flow.

---

## Phase 1: Auth flow hardening and protected entry

### Changes Required

1. `src/pages/api/auth/signin.ts`
- Add Zod validation for `email` and `password` from form data.
- Redirect successful signin to `/dashboard`.

2. `src/pages/api/auth/signup.ts`
- Add Zod validation for `email`, `password`, and `confirmPassword`.
- Enforce password min length and password confirmation parity server-side.

3. `src/pages/auth/signin.astro`
- If user is already authenticated, redirect to `/dashboard`.

4. `src/pages/auth/signup.astro`
- If user is already authenticated, redirect to `/dashboard`.

5. `package.json`
- Add `zod` dependency.

### Success Criteria

#### Automated

- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual

- Signup with valid data reaches confirmation flow.
- Signup with mismatched passwords is rejected server-side.
- Signin with valid credentials redirects to `/dashboard`.
- Opening `/auth/signin` or `/auth/signup` while authenticated redirects to `/dashboard`.
- Opening `/dashboard` while unauthenticated redirects to `/auth/signin`.

---

## References

- `context/foundation/roadmap.md` (S-01)
- `src/pages/api/auth/signin.ts`
- `src/pages/api/auth/signup.ts`
- `src/pages/auth/signin.astro`
- `src/pages/auth/signup.astro`
- `src/middleware.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Auth flow hardening and protected entry

#### Automated

- [x] 1.1 TypeScript compiles (`npx tsc --noEmit`) — d9d8b8c
- [x] 1.2 Lint passes (`npm run lint`) — d9d8b8c

#### Manual

- [ ] 1.3 Signup valid flow reaches confirm-email
- [ ] 1.4 Signup mismatch passwords rejected server-side
- [ ] 1.5 Signin success redirects to /dashboard
- [ ] 1.6 Authenticated user is redirected away from /auth/signin and /auth/signup
- [ ] 1.7 Unauthenticated user is redirected from /dashboard to /auth/signin
