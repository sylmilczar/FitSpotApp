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