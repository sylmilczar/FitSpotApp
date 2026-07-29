# App Routing Foundation Implementation Plan

## Overview

Implement a coherent MVP routing contract where `/` is the public home entrypoint, users can move to auth or `/classes`, successful login returns the user to their origin context, and `/dashboard` is removed from the product flow.

## Current State Analysis

Routing behavior is currently split across middleware and auth handlers with hardcoded dashboard redirects, which conflicts with the desired public-home-first flow.

## Desired End State

A guest entering `/` sees a public homepage (who we are + contact + CTAs), can navigate to auth or `/classes`, and after sign-in returns to their original destination (fallback `/classes`). `/dashboard` is no longer part of runtime routing.

### Key Discoveries:

- Auth page guard redirects authenticated users to `/dashboard` in middleware at `src/middleware.ts:39`.
- Successful sign-in redirects to `/dashboard` in `src/pages/api/auth/signin.ts:48`.
- Top navigation still exposes dashboard link in `src/components/Topbar.astro:26`.
- Home route is already a dedicated entrypoint (`src/pages/index.astro:7`) using `Welcome` composition.
- Sign-out already returns to `/` (`src/pages/api/auth/signout.ts:9`), aligned with target behavior.

## What We're NOT Doing

- No manager/admin route redesign in this change.
- No booking-domain logic changes.
- No redesign of `/classes` timetable behavior beyond navigation entry consistency.
- No introduction of role-based post-login destinations in this iteration.

## Implementation Approach

Introduce a small centralized routing contract (default destinations + safe return-to rules), wire middleware and sign-in flow to use it, remove dashboard dependencies from nav/routes, and modernize homepage content to match the agreed public-entry scope.

## Critical Implementation Details

Return-to handling must be sanitized to prevent open redirects. Only allow app-internal absolute paths (starting with `/`), and reject external URLs or protocol-prefixed values.

## Phase 1: Routing Contract and Redirect Rules

### Overview

Create a single source of truth for routing destinations and return-to parsing, then apply it in middleware and sign-in API handler.

### Changes Required:

#### 1. Routing contract utility

**File**: `src/lib/routing.ts` (new)

**Intent**: Consolidate route constants and redirect helper behavior so post-auth and guard redirects are not duplicated.

**Contract**: Export constants for `HOME_ROUTE`, `CLASSES_ROUTE`, `AUTH_SIGNIN_ROUTE`, `AUTH_SIGNUP_ROUTE`, and helper(s): `getSafeReturnTo(value: string | null): string | null`, plus `getPostLoginDestination(returnTo: string | null): string`.

#### 2. Middleware auth-page guard and admin fallback

**File**: `src/middleware.ts`

**Intent**: Remove dashboard coupling and enforce new behavior for authenticated users on auth pages.

**Contract**: 
- Auth page guard uses sanitized `returnTo` query if present, else `/classes`.
- Unauthorized admin fallback no longer points to `/dashboard`; use `/classes` as safe authenticated default.
- Protected route list no longer depends on `/dashboard`.

#### 3. Sign-in API post-success destination

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Return users to origin context after successful sign-in.

**Contract**: Read optional `returnTo` from submitted form data, sanitize via routing helper, and redirect to safe destination (fallback `/classes`).

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual Verification:

- Logged-in user entering `/auth/signin?returnTo=/` is redirected to `/`.
- Logged-in user entering `/auth/signin?returnTo=/classes` is redirected to `/classes`.
- Invalid returnTo values (external URL) are ignored and fallback to `/classes`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Public Homepage and Navigation Contract

### Overview

Align visible navigation and homepage content to the new routing foundation and remove dashboard from user-facing flow.

### Changes Required:

#### 1. Homepage content refresh

**File**: `src/components/Welcome.astro`

**Intent**: Provide a lean public homepage with who-we-are and contact context plus clear CTAs.

**Contract**: Keep `/` as static public landing but update sections so primary actions are auth and `/classes`, with concise “kim jesteśmy” and “kontakt” blocks.

#### 2. Top navigation cleanup

**File**: `src/components/Topbar.astro`

**Intent**: Make classes-first navigation and remove dashboard dependency.

**Contract**: Remove dashboard link from authenticated nav branch; keep classes + sign-out (auth) and classes + auth links (guest).

#### 3. Remove dashboard route

**File**: `src/pages/dashboard.astro` (delete)

**Intent**: Eliminate obsolete page from runtime to match agreed product flow.

**Contract**: Route file is removed and no active redirect points to `/dashboard`.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual Verification:

- Guest at `/` sees homepage with who-we-are/contact and CTAs to auth and `/classes`.
- Authenticated top navigation shows classes + sign-out, without dashboard.
- Visiting `/dashboard` no longer forms part of valid app journey.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Auth Page Return-To Propagation

### Overview

Ensure return-to context survives through auth UI and form submissions.

### Changes Required:

#### 1. Sign-in page context passthrough

**File**: `src/pages/auth/signin.astro`

**Intent**: Preserve incoming `returnTo` and make it available to the form.

**Contract**: Read `returnTo` query param and pass it to `SignInForm` as prop.

#### 2. Sign-in form hidden input support

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Submit sanitized flow context to API.

**Contract**: Accept optional `returnTo` prop and include hidden input `<input name="returnTo" ...>` when present.

#### 3. Auth page links preserve return target

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`

**Intent**: Keep user’s origin context when switching between sign-in and sign-up.

**Contract**: Auth cross-links append `?returnTo=...` when return target exists.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual Verification:

- User opening `/auth/signin?returnTo=/` and signing in returns to `/`.
- User opening `/auth/signin?returnTo=/classes` and signing in returns to `/classes`.
- Switching between sign-in and sign-up preserves `returnTo` context.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Testing Strategy

### Unit Tests:

- Validate return-to sanitizer against safe and unsafe inputs.
- Validate post-login destination fallback logic.

### Integration Tests:

- Middleware + auth page redirect behavior with and without `returnTo`.
- End-to-end sign-in redirect to origin route.

### Manual Testing Steps:

1. Open `/` as guest; verify public sections and CTA paths.
2. Open `/classes`, click sign-in, log in, verify return to `/classes`.
3. Open `/auth/signin?returnTo=/`, log in, verify return to `/`.
4. Validate dashboard is absent from nav and not required for flow.

## Performance Considerations

No heavy computation is introduced. The change adds lightweight redirect parsing and route-string handling only.

## Migration Notes

This is an application-routing migration. Remove stale references to `/dashboard` in docs/tests during implementation and verify no deep links in active UX paths rely on it.

## References

- Roadmap entry: `context/foundation/roadmap.md` (F-03)
- Current guard logic: `src/middleware.ts:5`, `src/middleware.ts:39`, `src/middleware.ts:50`
- Current sign-in redirect: `src/pages/api/auth/signin.ts:48`
- Current top navigation: `src/components/Topbar.astro:23`
- Home composition baseline: `src/pages/index.astro:7`, `src/components/Welcome.astro:28`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Routing Contract and Redirect Rules

#### Automated

- [x] 1.1 TypeScript compiles (`npx tsc --noEmit`) — 2acf705
- [x] 1.2 Lint passes (`npm run lint`) — 2acf705

#### Manual

- [x] 1.3 Auth-page returnTo `=/` redirects authenticated user to `/` — 2acf705
- [x] 1.4 Auth-page returnTo `=/classes` redirects authenticated user to `/classes` — 2acf705
- [x] 1.5 Invalid external returnTo falls back to `/classes` — 2acf705

### Phase 2: Public Homepage and Navigation Contract

#### Automated

- [x] 2.1 TypeScript compiles after homepage/nav/dashboard updates — a86fe5e
- [x] 2.2 Lint passes after homepage/nav/dashboard updates — a86fe5e

#### Manual

- [x] 2.3 Guest landing `/` shows public content and CTA paths — a86fe5e
- [x] 2.4 Auth top navigation excludes dashboard and keeps classes + sign-out — a86fe5e
- [x] 2.5 `/dashboard` is not part of the active app journey — a86fe5e

### Phase 3: Auth Page Return-To Propagation

#### Automated

- [x] 3.1 TypeScript compiles after auth form propagation changes
- [x] 3.2 Lint passes after auth form propagation changes

#### Manual

- [x] 3.3 Sign-in with returnTo `/` returns user to `/`
- [x] 3.4 Sign-in with returnTo `/classes` returns user to `/classes`
- [x] 3.5 Switching auth pages preserves returnTo context
