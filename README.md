# FitSpotApp

A web application for managing fitness class bookings, allowing clients to reserve spots online and administrators to manage schedules and attendance.

## Live Application

The application is available online at:

https://fit-spot-app.vercel.app/

## Local Development

### Requirements

- Node.js 22.14.0 or newer

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Add the `SUPABASE_URL` and `SUPABASE_KEY` values from your Supabase project to `.env.local`.

4. Start the development server:

   ```bash
   npm run dev
   ```

   The application will be available at:

   http://localhost:4321

To test the production version locally, use:

```bash
npm run build
npm run preview
```

## Local Supabase

If you are using a local Supabase instance, start it beforehand with:

```bash
npx supabase start
```

This requires Docker.

Use the local Supabase values in `.env.local` when working with the local database.