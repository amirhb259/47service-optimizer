# Netlify Deployment Guide

This repo deploys `admin-web` as a Next.js app on Netlify. Next API routes become Netlify Functions, so the old permanent Express backend is no longer required for production.

## 1. Create PostgreSQL

Create a PostgreSQL database in Supabase, Neon, or another hosted provider. Copy the production connection string and use the pooled/serverless connection URL if available.

The Prisma datasource now requires:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

## 2. Configure Netlify

Create a Netlify site connected to this repository.

Build settings:

```text
Build command: npm run netlify:build
Publish directory: admin-web/.next
```

The committed `netlify.toml` already contains those settings.

Set these Netlify environment variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
ADMIN_TOKEN="long-random-token"
ADMIN_DASHBOARD_USER="admin"
ADMIN_DASHBOARD_PASSWORD="long-random-password"
ADMIN_SESSION_SECRET="at-least-32-random-bytes"
API_CORS_ORIGIN="*"
```

`DATABASE_URL`, `ADMIN_TOKEN`, dashboard password, and session secret must stay server-only in Netlify environment variables. Do not add them to any `VITE_` or `NEXT_PUBLIC_` variable.

## 3. Deploy

Netlify runs:

```bash
npm run netlify:build
```

That command runs `prisma generate`, applies PostgreSQL migrations with `prisma migrate deploy`, and builds the Next admin website.

## 4. Configure Desktop Builds

Build the Tauri desktop app with the deployed Netlify URL:

```env
VITE_LICENSE_API_URL="https://YOUR-NETLIFY-SITE.netlify.app"
```

The desktop app calls:

```text
/api/license/validate
/api/license/key-login
/api/license/activate
/api/license/credentials-login
/api/license/lite
/api/support/tickets
```

Those endpoints are served by the deployed Netlify Next API routes.

## 5. Verify Production

After deployment:

1. Sign in to the Netlify admin website.
2. Create a license or admin account.
3. Build/run the desktop app with `VITE_LICENSE_API_URL` set to the Netlify site URL.
4. Confirm HWID/license activation and username/password login work.
5. Toggle premium in the admin website and confirm the desktop app receives `premium: true`.
6. Submit a support ticket in the desktop app and confirm it appears in the website.
