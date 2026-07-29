<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Client Auth Journey

- Plan: context/changes/client-auth-journey/plan.md
- Change: context/changes/client-auth-journey/change.md
- Date: 2026-07-29
- Verdict: APPROVED WITH FOLLOW-UPS
- Findings: [0 critical] [1 warnings] [1 observations]

## Scope Reviewed

- src/pages/api/auth/signin.ts
- src/pages/api/auth/signup.ts
- src/middleware.ts
- src/pages/auth/signin.astro
- src/pages/auth/signup.astro
- src/pages/auth/confirm-email.astro
- src/components/auth/FormField.tsx
- src/components/auth/SubmitButton.tsx
- src/components/auth/ServerError.tsx
- src/components/auth/PasswordToggle.tsx
- src/styles/global.css

## Findings

### I1 - Validation error strings are not normalized for end users

- Severity: WARNING
- Location: src/pages/api/auth/signin.ts, src/pages/api/auth/signup.ts
- Detail: The current handlers return the first raw Zod issue string. For malformed payloads, users can receive technical messages like expected type mismatches instead of consistent product copy.
- Risk: Inconsistent UX and potentially confusing feedback for users submitting partially filled forms.
- Recommended fix: Map validation failures to stable field-level messages (email/password/confirmPassword) and return product phrasing only.
- Decision: Follow-up task (non-blocking for archive).

### I2 - Missing automated regression tests for auth route behavior

- Severity: OBSERVATION
- Location: package.json scripts and auth API/middleware flows
- Detail: Behavior was verified manually and with lint/typecheck, but there is no automated test coverage for auth route redirects and payload validation.
- Risk: Future changes to middleware or auth handlers may regress signin/signup redirects without fast detection.
- Recommended fix: Add Vitest route tests for signin/signup handlers and middleware redirect rules.
- Decision: Follow-up task (non-blocking for archive).

## Outcome

Implementation matches planned scope for S-01 and is acceptable to archive after recording follow-up tasks above.
