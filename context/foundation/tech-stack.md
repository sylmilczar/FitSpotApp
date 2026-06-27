---
starter_id: 10x-astro-starter
package_manager: npm
project_name: fitspotapp
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

This project is a web MVP with a short three-week, after-hours timeline and a must-have authentication flow, so the safest route is the vetted default for web + JavaScript. The 10x Astro Starter gives a convention-based TypeScript stack with auth, database, and deploy path aligned out of the box, which reduces setup drag for a solo build. It also stays consistent with your PRD scope: auth is in, while payments, realtime, AI, and background jobs are out for now. Deploying to Cloudflare Pages with GitHub Actions auto-deploy keeps the delivery pipeline simple and fast while preserving room to scale later if needed.

## Important Bootstrap Notes

**⚠️ Adapter mismatch warning**: The `10x-astro-starter` bootstrap created this project with `deployment_target: cloudflare-pages`. This means:

- `package.json` includes `@astrojs/cloudflare` adapter and `wrangler` CLI (Cloudflare Workers tooling)
- `astro.config.mjs` imports and configures the Cloudflare adapter
- Root directory contains `wrangler.jsonc` (Cloudflare Workers configuration)
- `.gitignore` includes Cloudflare-specific entries (`.wrangler/`, `.dev.vars`)

**When deploying to a different platform** (e.g., Vercel per `@infrastructure.md`), you must remove these artifacts:

```bash
# Remove Cloudflare adapter and tooling from package.json
npm uninstall @astrojs/cloudflare wrangler

# Remove Cloudflare config file
rm wrangler.jsonc

# Update astro.config.mjs to use your target adapter
# For Vercel: import vercel from "@astrojs/vercel"; adapter: vercel()
```

This is a one-time cleanup during platform selection. The bootstrap assumes Cloudflare; your infrastructure decision may require a different target.

**CSS framework note**: If the starter includes Tailwind 4, verify that `src/styles/global.css` uses `@tailwind` directives (`@tailwind base; @tailwind components; @tailwind utilities;`), not the older `@import "tailwindcss"` syntax. This is checked automatically during `npm run build`, but early awareness saves debugging time.