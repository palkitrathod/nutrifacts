# Nutrifacts

Personalised nutrition care with Dt. Anchal Dewan: public home page, patient sign-up / sign-in, and the patient & dietitian app.

## Run locally

Requires Node.js 22+.

```bash
npm install
npm run dev        # web on http://localhost:5173, auth API on :3001 (proxied at /api)
```

In development, sample accounts are created automatically (password `Demo@1234`):

| Account | Email |
| --- | --- |
| Patient | priya.sharma@example.com |
| Patient | rohan.verma@example.com |
| Dietitian (admin) | anchaldewan380@gmail.com |

## Production

```bash
npm run build
npm start          # serves site + API on PORT (default 3000)
```

The dietitian login comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.production` (git-ignored; production only).
Run behind HTTPS (session cookies are `Secure` in production). See `.env.example` for all settings.
Data is stored in SQLite at `data/nutrifacts.db` — back this file up.

## Deploy on Render

The repo includes `render.yaml` (one web service + a 1 GB persistent disk for the database).

1. In Render: **New → Blueprint**, connect GitHub, pick this repository.
2. Enter `ADMIN_EMAIL` and `ADMIN_PASSWORD` (the dietitian's login) when asked.
3. Create. Render builds (`npm ci --include=dev && npm run build`) and starts (`npm start`).

Pushing to `main` redeploys automatically. Persistent disks need a paid instance (Starter).
Sample accounts are off in production; the price list is seeded on first start.

## Tests

```bash
npm test           # API, validation and UI tests (Vitest)
npm run test:e2e   # browser tests on desktop + mobile against a production build (Playwright)
npm run lint       # type-check
```

## How auth works

- Passwords: scrypt with per-user salt; never stored or logged in plain text.
- Sessions: random token in an `httpOnly`, `SameSite=Lax` cookie; only its SHA-256 hash is stored. Sign-out deletes it server-side.
- "Keep me signed in" = 30 days; otherwise the session ends with the browser (server cap: 1 day).
- Failed sign-ins are limited to 10 per 15 minutes per network + email; sign-ups to 20 per hour per network.
- Self sign-up always creates a **patient**. The dietitian account comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Password reset is handled by the clinic via WhatsApp until an email service is added.

## How data works

- All app data lives in the server database (`records` table: one JSON record per diet chart, appointment, payment…, tagged with its owner). The browser keeps no health data.
- `GET /api/data` returns only what the signed-in person may see; changes are auto-saved through `POST /api/data/batch`, where every write is checked (`server/data.ts`): patients can only write their own records, cannot edit diet charts or prices, cannot change appointments or payments after creating them, and payment amounts must match the live price.
- `GET /api/packages` is the public price list used by the home page.
- Production seeds only the price list; development also seeds the sample patients' histories.
