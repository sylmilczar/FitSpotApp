### FitSpotApp

A web application for managing fitness class bookings, allowing clients to reserve spots online and administrators to manage schedules and attendance.

## Uruchamianie lokalne

Wymagania: Node.js 22.14.0 lub nowszy.

1. Zainstaluj zależności:

   ```bash
   npm install
   ```

2. Utwórz lokalny plik środowiskowy:

   ```bash
   cp .env.example .env.local
   ```

3. Uzupełnij w `.env.local` wartości `SUPABASE_URL` i `SUPABASE_KEY` danymi projektu Supabase.

4. Uruchom serwer deweloperski:

   ```bash
   npm run dev
   ```

   Aplikacja będzie dostępna pod adresem [http://localhost:4321](http://localhost:4321).

Do sprawdzenia wersji produkcyjnej użyj:

```bash
npm run build
npm run preview
```

Jeśli korzystasz z lokalnego Supabase, uruchom je wcześniej poleceniem `npx supabase start` (wymaga Dockera) i użyj lokalnych wartości w `.env.local`.

**For AI agent guidance, see [@AGENTS.md](AGENTS.md).**
