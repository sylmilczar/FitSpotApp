# Deploy Plan: First Deploy — Cloudflare → Vercel Migration + Production Deploy

**Date:** 2026-06-27
**Platform:** Vercel (per infrastructure.md)
**Stack:** Astro 7 + React 19 + Supabase (external)
**Workflow:** Development branch (local Supabase) → Main branch (production Supabase + Vercel)

## Context

- ~~Codebase is wired for Cloudflare Workers (`@astrojs/cloudflare`, `wrangler.jsonc`)~~ — migrated to Vercel
- Decision: follow `infrastructure.md` and deploy to Vercel ✅
- Strategy: test locally on `development` branch with `npx supabase start`, then merge to `main` for production
- **Tailwind 4 gotcha:** uses `@tailwindcss/vite` Vite plugin + `@import "tailwindcss"` in CSS. Do NOT use `@tailwind` directives (v3 syntax) or `postcss.config.*` / `tailwind.config.*` files — they break CSS generation.

---

## Phase 0 — Local Development Setup (development branch) ✅ COMPLETED

**Completed:** 2026-06-27 at 19:30 UTC

1. ✅ `git checkout -b development` — create development branch
2. ✅ `npm install` — ensure dependencies are up to date
3. ✅ Install Supabase CLI: `brew install supabase/tap/supabase` (macOS) or follow [docs](https://supabase.com/docs/guides/cli/getting-started)
4. ✅ `npx supabase start` — boots local Supabase instance (Docker required; runs on `localhost:54321`)
5. ✅ `npx supabase db reset` — recreates local database from version-controlled migrations in `supabase/migrations/`, ensuring a clean and reproducible development environment
6. ✅ `npm run dev` — start Astro dev server on `localhost:4321`, test against local Supabase
7. ✅ Test locally:
   - ✅ Sign-up, sign-in, access `/dashboard`, sign-out
   - ✅ Verify user appears in local Supabase Auth dashboard
   - ✅ Session persistence confirmed (refresh keeps user logged in)
   - ✅ Protected routes redirect unauthenticated users to `/auth/signin`

---

## Phase 1 — Adapter Migration (development branch) ✅ COMPLETED

**Status:** Completed on 2026-06-27 18:28 UTC

8. `npm install @astrojs/vercel`
9. Edit `astro.config.mjs`:
    - `import cloudflare from "@astrojs/cloudflare"` → `import vercel from "@astrojs/vercel"`
    - `adapter: cloudflare()` → `adapter: vercel()`
    - Restore `vite: { plugins: [tailwindcss()] }` using `@tailwindcss/vite` (required for CSS generation)
10. `npm uninstall @astrojs/cloudflare` — remove obsolete adapter
11. Clean up unused Cloudflare config:
    ```bash
    rm wrangler.jsonc
    ```
12. Ensure `src/styles/global.css` starts with `@import "tailwindcss"` (Tailwind 4 syntax — NOT `@tailwind` directives)
13. `npm run build` — validate the build succeeds with new adapter
14. Commit changes: `git add -A && git commit -m "feat: migrate from Cloudflare to Vercel adapter"`

---

## Phase 2 — Merge & Production Supabase Setup (main branch) ✅ COMPLETED

**Status:** Completed on 2026-06-27 18:45 UTC

15. `git checkout main && git merge development` — merge adapter changes to main
16. Go to https://supabase.com → New project (separate from dev) → note **Project URL** and **Project Ref**
17. In Supabase dashboard: **Authentication → URL Configuration** → set Site URL to a placeholder; update to production URL after deploy
18. Apply migrations to production Supabase using CLI:
    ```bash
    npx supabase link --project-ref <your-prod-project-ref>
    npx supabase db push
    ```
    This applies all migrations from `supabase/migrations/` to the empty production database.

---

## Phase 3 — Vercel Project Setup (main branch) ✅ COMPLETED

**Status:** Completed on 2026-06-27 20:00 UTC

19. ✅ `npx vercel login` — authenticate with Vercel account
20. ✅ `npx vercel link` — creates project `fit-spot-app` under `sylmilczars-projects`; `.vercel/project.json` created (in `.gitignore`)
21. ✅ Set production secrets via `npx vercel env add` (not `env set`):
    ```bash
    npx vercel env add SUPABASE_URL   # → Production, Non-sensitive
    npx vercel env add SUPABASE_KEY   # → Production, Sensitive
    ```
    > **Note:** CLI uses `env add`, not `env set`. Environment must be selected with spacebar in the interactive prompt.
22. ✅ `npx vercel env pull .env.local` pulls Development env vars (not Production — Production vars are injected at runtime by Vercel, not downloaded)

---

## Phase 4 — Production Deploy (main branch) ✅ COMPLETED

**Status:** Fully deployed and verified (2026-06-27 20:30 UTC)

23. ✅ `npx vercel deploy` — deployed to production URL: `https://fit-spot-app.vercel.app` (CSS broken)
    - ⚠️ CSS broken on first deploy (Tailwind 4 misconfiguration)
    - ✅ CSS fixed locally
24. ✅ Re-deploy after CSS fix: `git commit + npx vercel deploy --prod`
    - ✅ Deployed successfully at `https://fit-spot-app.vercel.app`
    - ✅ Aliased to production domain
25. ✅ Test on production URL:
    - ✅ Homepage loads with correct styling (gradient background, white text, card layouts)
    - ✅ Sign-up flow works (creates user in production Supabase)
    - ✅ Sign-in flow works (redirects to `/dashboard`)
    - ✅ Dashboard is protected (unauthenticated redirects to `/auth/signin`)
    - ✅ Sign-out works (returns to homepage)
    - ⚠️ Note: Email confirmation was disabled in prod Supabase for MVP
26. ✅ Update Supabase Site URL:
    - ✅ Dashboard → Settings → Authentication → URL Configuration
    - ✅ Site URL: `https://fit-spot-app.vercel.app` (updated from placeholder)
26. ⬜ Update Supabase **Site URL** to `https://fit-spot-app.vercel.app` (**Authentication → URL Configuration**)

---

## Relevant Files

| File | Role |
|---|---|
| `astro.config.mjs` | Adapter swap — only code file that changes |
| `package.json` | Adapter dependency |
| `.gitignore` | Now includes `.vercel/` (already updated) |
| `src/middleware.ts` | Uses `@supabase/ssr` (isomorphic, safe on Vercel serverless) |
| `src/lib/supabase.ts` | Reads env via `astro:env/server`: `SUPABASE_URL` and `SUPABASE_KEY` |
| `wrangler.jsonc` | Removed after migration (via `rm wrangler.jsonc`) |
| `supabase/migrations/` | Version-controlled database migrations applied locally via `supabase db reset` and to production via `supabase db push` |
| `supabase/config.toml` | Local Supabase config (used by `npx supabase start`) |

---

## Verification Checklist

### Phase 0 (Local Development)
- [ ] `npx supabase start` runs without Docker errors
- [ ] `npx supabase db reset` recreates local database from migrations successfully
- [ ] `npm run dev` connects to local Supabase
- [ ] Sign-up creates user in local Supabase Auth
- [ ] Sign-in/sign-out flow works locally
- [ ] `/dashboard` redirects when unauthenticated

### Phase 1 (Adapter + Build)
- [ ] `npm run build` passes with Vercel adapter
- [ ] `npm run preview` loads homepage locally
- [ ] `wrangler.jsonc` removed

### Phase 2 (Production Supabase)
- [ ] Production Supabase project created
- [ ] `npx supabase db push` applies migrations to production successfully
- [ ] Production Supabase Auth dashboard is accessible

### Phase 4 (Production)
- [ ] Preview URL loads homepage
- [ ] Sign-up creates a user visible in production Supabase Auth
- [ ] Sign-in redirects to `/dashboard`
- [ ] Unauthenticated access to `/dashboard` redirects to `/auth/signin`
- [ ] Refreshing the page while authenticated keeps the user session active
- [ ] Sign-out returns to homepage
- [ ] Production URL loads correctly after `vercel deploy --prod`
- [ ] Supabase Site URL updated to production URL

---

## Post-Deploy (Optional)

After verifying production is working:

- Set up GitHub auto-deploy: `npx vercel git connect` — enables automatic deployments on push to `main` and preview URLs for PRs
- Delete development branch: `git checkout main && git branch -d development` (after final verification)
- Enable Supabase connection pooling if load testing shows connection pool exhaustion

---

## ✅ DEPLOYMENT SUMMARY

**🎉 FIRST PRODUCTION DEPLOYMENT COMPLETE**

| Phase | Status | Details |
|-------|--------|---------|
| Phase 0 — Local Dev | ✅ Complete | Local Supabase running, auth flow tested |
| Phase 1 — Adapter Migration | ✅ Complete | Cloudflare → Vercel, Tailwind 4 configured |
| Phase 2 — Production Supabase | ✅ Complete | Project created, migrations applied |
| Phase 3 — Vercel Setup | ✅ Complete | Project linked, env vars configured |
| Phase 4 — Deploy & Verify | ✅ Complete | Production live, all tests passing, Site URL updated |

**Production URL:** https://fit-spot-app.vercel.app

**All Tests Passing:**
- ✅ Homepage: dark gradient, white text, proper layout
- ✅ Sign-up: creates user in production Supabase
- ✅ Sign-in: authenticates and redirects to `/dashboard`
- ✅ Protected routes: `/dashboard` enforces authentication
- ✅ Session: persists across page refresh
- ✅ Sign-out: logs user out, returns to homepage

**Key Decisions:**
- Email confirmation disabled in production Supabase (removed friction for MVP)
- Tailwind 4 Vite plugin restored and verified working
- Vercel CLI account corrected (sylmilczar personal account)

**Next Steps (Optional):**
- GitHub auto-deploy: `npx vercel git connect`
- Custom domain: via Vercel dashboard
- Monitoring/analytics: post-launch

**Ready for:** Feature development, user testing, marketing launch 🚀

---

## Out of Scope

- Custom domain / SSL — post-launch, one-click in Vercel dashboard
- Advanced CI/CD pipeline — not blocking first deploy
- Supabase advanced features (RLS fine-tuning, connection pooling, backups) — post-launch steps
- Multi-region / HA — beyond MVP scope
