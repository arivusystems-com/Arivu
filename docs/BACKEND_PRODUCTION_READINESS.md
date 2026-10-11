# Backend production readiness

Companion to [`OCI_VM_DEPLOYMENT.md`](./OCI_VM_DEPLOYMENT.md) (infrastructure runbook). This page covers what the
`server/` package itself requires and how to verify a release before it is deployed.

## Runtime

- **Node.js `^22.12.0`** (Node 22 line). Declared in `server/package.json` `engines` and `server/.nvmrc`.
  `puppeteer-core@25` requires `>=22.12.0` and is ESM-only; the renderer loads it with dynamic `import()`.
- **npm** with `server/package-lock.json` (lockfile v3). The lockfile is committed; it was previously gitignored,
  which made `npm ci` impossible and let each VM resolve different dependency versions.

```bash
cd server
nvm use            # reads server/.nvmrc
npm ci --omit=dev  # production install (API and Worker VMs)
npm ci             # development / CI (includes mongodb-memory-server)
```

Never run `npm install <pkg>@latest` or `npm audit fix --force` on a VM. Change dependencies in Git, commit the
updated lockfile, and deploy the tag.

## Processes

| Process | Command | Required env | Must not set |
|---------|---------|--------------|--------------|
| API VM | `node server.js` | `PORT=5000`, `ENABLE_SCHEDULED_JOBS=false`, `ENABLE_BULL_IN_WEB=false`, `PUPPETEER_EXECUTABLE_PATH` | — |
| Worker VM | `node worker.js` | `REDIS_URL` (worker exits without Redis) | `PORT` is not read |

With both flags `false`, the API starts no cron jobs, Bull consumers, analytics/tally schedulers, or mailroom retry
worker; it still enqueues jobs to Redis. The Worker always runs consumers and cron (cron ticks take a Redis lock).
Flag values must be exactly `true` or `false`; anything else is fatal at production startup.

## Required production configuration

Startup exits with a `FATAL` line (values are never printed) when any of these are missing or invalid:

- `JWT_SECRET` (≥ 24 chars), `CLIENT_URL` (non-localhost), `DISABLE_SECURITY` not `true`
- `MONGODB_URI` — `mongodb://` or `mongodb+srv://`; credentials must be percent-encoded
- `REDIS_URL` or `REDIS_HOST` (unless `REDIS_HEALTH_BLOCKS_READY=false`)
- `PORT` is an integer 1–65535 when set

Recommended: `TENANT_SECRET_ENCRYPTION_KEY` (otherwise tenant secrets are encrypted with `JWT_SECRET`), and
`HEALTH_DETAILS_TOKEN` / `MAILROOM_METRICS_TOKEN` if operators need those endpoints.

Secrets live in OCI Vault (runbook section 6), never in Git. `server/.env.example` contains placeholders only.
`scripts/createDefaultAdmin.js` and `scripts/resetAdminPassword.js` refuse to run in production without an explicit
`DEFAULT_ADMIN_PASSWORD` (≥ 12 chars, not a known default) and do not print it.

## PDF rendering (API VM)

Install Google Chrome stable (amd64) and fonts, then point the API at it:

```bash
curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y /tmp/chrome.deb fonts-liberation fonts-noto-core
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

Resolution order: `PUPPETEER_EXECUTABLE_PATH`, `CHROME_PATH`, standard system paths
(`/usr/bin/google-chrome-stable`, `/usr/bin/google-chrome`, `/usr/bin/chromium-browser`, `/usr/bin/chromium`), then
Puppeteer's browser cache. A configured path that is not an executable file is logged and skipped. With no browser,
PDF requests fail with `CONTENT_RENDER_NOT_IMPLEMENTED` (HTTP 503) and a message naming the variables to set.

## Health endpoints

| Route | Auth | Use |
|-------|------|-----|
| `GET /health/live` | public | liveness |
| `GET /health/ready` | public | load balancer: 200 when Mongo is connected and Redis pings (production); 503 otherwise. Redis error text only with `HEALTH_DETAILS_TOKEN`. |
| `GET /health/status` | `HEALTH_DETAILS_TOKEN` | operator detail (no DB host). 404 in production without the token configured. |
| `GET /health/mailroom-metrics` | `MAILROOM_METRICS_TOKEN` | Prometheus text. 404 in production without the token configured. |

Send tokens as `Authorization: Bearer <token>` (or `X-Health-Token` / `X-Metrics-Token`).

## Pre-release verification

Run from `server/` on Node 22.12+. None of these need live credentials, a database, or network mail.

```bash
npm run test:pdf-renderer             # mocked; no Chrome needed
npm run test:pdf-renderer:integration # real Chrome; skips with a reason if none is found
npm run test:csv-import
npm run test:email-providers          # in-process fake SMTP server; no mail is sent
npm run test:production-readiness     # env validation, Mongo URI, health routes
npm run security:audit:prod           # npm audit --omit=dev
```

## Known remaining audit findings (moderate)

| Package | Cause | Fix | Notes |
|---------|-------|-----|-------|
| `@sentry/node@8` | transitive `@opentelemetry/*` (baggage memory DoS, `db.user` span attribute) | `@sentry/node@11` (major) | Only `server/lib/sentryNode.js` uses Sentry; migrate init/handler APIs and verify Express error capture. Requires Node ≥ 22.12 (met). |
| `aws-sdk@2` | v2 region-validation advisory; bundles `uuid@8` | migrate to `@aws-sdk/client-s3` / `client-route-53` (v3) | Used by `services/objectStorageService.js` and `services/provisioning/managers/dnsManager.js`. `npm audit` suggests `aws-sdk@1.18.0` — do **not** apply. |
| `bull`, `node-cron`, `exceljs`, `googleapis` | bundled `uuid@8/9` (buffer bounds check when `buf` is passed) | upstream majors | App code only calls `uuid.v4()` without `buf`; `uuid` is now a declared dependency at `^11.1.1`. |
