# Plan Brief: client-auth-journey

## Goal
Implement S-01 first: a client can sign up, sign in, and enter a protected app flow.

## Scope
- Server-side validation on signup/signin API routes using Zod.
- Post-signin redirect to `/dashboard`.
- Redirect authenticated users away from auth pages.

## Files
- `src/pages/api/auth/signin.ts`
- `src/pages/api/auth/signup.ts`
- `src/pages/auth/signin.astro`
- `src/pages/auth/signup.astro`
- `package.json`

## Verification
- Automated: `npx tsc --noEmit`, `npm run lint`
- Manual: signup/signin/redirect smoke tests from plan.md

## Out of Scope
- Booking browsing/reservations (S-03/S-02)
- Manager/admin operations (S-04/S-05)
