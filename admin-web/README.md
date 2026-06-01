# 47Service License Admin

Next.js dashboard and API backend for 47Service license and support administration.

On Netlify, the API routes in `app/api` are deployed as Netlify Functions. The old Express server is not required in production.

## Environment

Use the root `.env.example` for local development values. Production secrets must be configured in Netlify environment variables.

Required server-only values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
ADMIN_TOKEN="long-random-token"
ADMIN_DASHBOARD_USER="admin"
ADMIN_DASHBOARD_PASSWORD="long-private-password"
ADMIN_SESSION_SECRET="at-least-32-random-bytes"
API_CORS_ORIGIN="*"
```

## Run

From the repository root:

```powershell
npm run prisma:generate
npm run admin:dev
```

Open `http://127.0.0.1:3001` and sign in with `ADMIN_DASHBOARD_USER` and `ADMIN_DASHBOARD_PASSWORD`.

## Deploy

See [../NETLIFY_DEPLOYMENT.md](../NETLIFY_DEPLOYMENT.md).
