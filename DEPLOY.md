# Deploying IronCore for free

Three free services, no card required:

| Piece | Host | Free tier |
| --- | --- | --- |
| Database | MongoDB Atlas | M0 — 512 MB, no expiry |
| API (`GYMBACKEND`) | Render web service | 750 hrs/mo, sleeps when idle |
| Web (`GYMFRONTEND`) | Vercel Hobby | Non-commercial use |

## The one thing that makes this work

The session is three cookies, and the refresh cookie is `SameSite=Lax`
(`GYMBACKEND/src/auth/tokens.service.ts`). A browser will not send a `Lax`
cookie on a cross-site request, so a web app on `*.vercel.app` calling an API
on `*.onrender.com` would sign people in and then 401 every request after it.

So the browser never talks to the API directly. `GYMFRONTEND/next.config.ts`
rewrites `/api/*` to the API, and the browser only ever sees one origin — its
own. Cookies stay first-party, `SameSite=Lax` keeps working, and CORS stops
mattering in the browser at all. The same path is used in development, so what
you test locally is what runs in production.

Because of the rewrite the browser's URL is `/api/auth/refresh`, not
`/auth/refresh`. Cookie paths are matched against that URL, so
`COOKIE_PATH_PREFIX=/api` must be set on the API — otherwise the refresh cookie
is scoped to `/auth`, is never sent, and every session dies after 15 minutes.

## 1. Database — MongoDB Atlas

1. Create a free **M0** cluster.
2. **Database Access** → add a user with a password.
3. **Network Access** → allow `0.0.0.0/0`. Render's free tier has no fixed
   egress IP, so there is nothing narrower to allowlist.
4. Copy the `mongodb+srv://...` connection string.

## 2. API — Render

Push the repo to GitHub, then either import `GYMBACKEND/render.yaml` as a
blueprint, or create a **Web Service** by hand with:

- Root directory: `GYMBACKEND`
- Build: `npm ci && npm run build`
- Start: `npm run start:prod`
- Health check path: `/health`

Environment variables:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | the Atlas string |
| `MONGODB_DB` | `ironcore` |
| `JWT_ACCESS_SECRET` | 48 random bytes (below) |
| `JWT_REFRESH_SECRET` | a *different* 48 random bytes |
| `COOKIE_SECURE` | `true` |
| `COOKIE_PATH_PREFIX` | `/api` |
| `CORS_ORIGINS` | your Vercel URL |
| `PAYMENTS_PROVIDER` | `mock` until Paystack keys are ready |
| `PAYMENT_CALLBACK_URL` | `https://<your-app>.vercel.app/payments/callback` |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Note the service URL, e.g. `https://ironcore-api.onrender.com`.

## 3. Web — Vercel

Import the same repo with **root directory `GYMFRONTEND`**. One environment
variable:

| Key | Value |
| --- | --- |
| `API_ORIGIN` | `https://ironcore-api.onrender.com` |

It has no `NEXT_PUBLIC_` prefix on purpose: it is read by `next.config.ts` on
the server, and the browser never sees it. Do **not** set
`NEXT_PUBLIC_API_URL` — that bypasses the proxy and reintroduces the cookie
problem.

Deploy, then go back and set the API's `CORS_ORIGINS` and
`PAYMENT_CALLBACK_URL` to the real Vercel URL.

## 4. Seed the first accounts

Run once from your machine, pointed at the production database:

```bash
cd GYMBACKEND && MONGODB_URI="<atlas string>" npm run seed
```

## Checks

```bash
curl https://<api>.onrender.com/health          # {"status":"ok","database":"up"}
curl https://<app>.vercel.app/api/health        # the same, through the proxy
```

Then sign in and leave the tab for 20 minutes. If you are still signed in
afterwards, the refresh cookie is scoped correctly.

## What the free tiers cost you

- **Render sleeps after 15 minutes idle.** The next request takes ~50 seconds
  while it wakes. Fine for a demo, not for a gym's front desk — a paid instance
  is the fix. An uptime pinger against `/health` is a common workaround and is
  against Render's free-tier terms.
- **Atlas M0** has no backups. Do not put a real gym's records on it.
- **Vercel Hobby** is non-commercial. Charging gyms means a paid plan.
- **The camera needs HTTPS.** Both hosts give you that, so the scanner works on
  deployed URLs — but not if you point a phone at your laptop's LAN IP in
  development.
