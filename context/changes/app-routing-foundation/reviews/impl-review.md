# Impl Review - app-routing-foundation

Date: 2026-07-29
Reviewer: Copilot (GPT-5.3-Codex)
Scope: commits `2acf705..3d2270a` (Phase 1-3 + epilogue)

## Findings (ordered by severity)

### Medium - Scope drift in final phase commit
- Location: `60659a6` (`feat(app-routing-foundation): auth returnTo propagation (p3)`)
- Evidence: phase-3 commit includes visual/theme assets and global background changes (`src/assets/uptownfitness-fitness-1948813.jpg`, `src/layouts/Layout.astro`, `src/styles/global.css`, `src/components/Welcome.astro`) in addition to routing/auth propagation goals.
- Why this matters: plan phase boundaries become less auditable and future regressions are harder to bisect when unrelated UI experiments are bundled with routing behavior.
- Recommendation: for next changes, isolate visual experiments into dedicated change IDs or at least separate commits within the same branch.

### Low - Test-mode background is now global runtime behavior
- Location: `src/layouts/Layout.astro`, `src/styles/global.css`
- Evidence: `body` always has `class="app-photo-bg"`; test background image applies to all routes.
- Why this matters: this was introduced as exploratory styling and may not be intended as default production UX.
- Recommendation: gate it behind a class toggle/env flag or keep as-is only if product owner explicitly approves this as the new default.

## Verified positives

- Return-to sanitization exists and rejects unsafe paths in `src/lib/routing.ts`.
- Middleware auth guard now routes authenticated users from auth pages via safe return-to fallback in `src/middleware.ts`.
- Sign-in API uses post-login destination helper in `src/pages/api/auth/signin.ts`.
- Auth pages preserve return-to context between sign-in/sign-up in `src/pages/auth/signin.astro` and `src/pages/auth/signup.astro`.
- Dashboard route removed (`src/pages/dashboard.astro` deleted) and top navigation no longer links dashboard.

## Validation evidence

- `npx tsc --noEmit`: pass
- `npm run lint`: pass
- Diagnostics scan (`get_errors`): no errors found

## Verdict

- Implementation is functionally sound against routing goals.
- Accept with notes: findings are process/scope hygiene and product decision alignment, not correctness blockers.
