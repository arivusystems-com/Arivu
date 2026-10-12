# Arivu — production deployment (Arivu Systems)

OCI provisioning is in [OCI_VM_DEPLOYMENT.md](./OCI_VM_DEPLOYMENT.md). Follow that order: network, bastion, MongoDB 8 replica set `rs0`, Redis, Object Storage, Vault, API pool size 1, Worker pool size 1, load balancer, DNS, production smoke tests, legacy quote/invoice migration, API pool size 2, Worker pool size 2, then consider autoscaling. API and Worker require Node.js 22.12.0 or newer on the Node 22 line. This design does not use Docker or Kubernetes.

The product split:

| Surface | Hostname | Platform |
|--------|-----------|----------|
| Marketing / website | `arivusystems.com` | Your static site (not this repo) or a separate Vercel project |
| **Web app (Vue)** | `app.arivusystems.com` | **Vercel** — deploy from the `client/` app |
| **API + workers** | `api.arivusystems.com` | **OCI instance pools** behind an OCI load balancer — [OCI_VM_DEPLOYMENT.md](./OCI_VM_DEPLOYMENT.md) |
| Database | — | **MongoDB** on a private OCI VM (auth, single-member replica set) |
| Queue / cache | — | **Redis** on a private OCI VM (`AOF`, `maxmemory-policy=noeviction`) |
| Object storage | — | **OCI Object Storage** (`IMPORT_STORAGE_DRIVER=oci`) |
| Email | — | OCI Email Delivery and AMDS |
| DNS / TLS | — | Hostinger DNS. TLS for `api` terminates on the OCI load balancer. `app` stays on Vercel. |
| Errors | — | **Sentry** (`SENTRY_DSN` server, `VITE_SENTRY_DSN` client) |
| Product analytics | — | **PostHog** (`VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` optional) |

Kubernetes is **not** part of this design.

## Backend (OCI)

Click-by-click OCI steps, instance pools, and verification are in [OCI_VM_DEPLOYMENT.md](./OCI_VM_DEPLOYMENT.md).

API process: `node server.js` with `ENABLE_BULL_IN_WEB=false`, `ENABLE_SCHEDULED_JOBS=false`, `PORT=5000`, `EXPRESS_TRUST_PROXY=1`, and `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`. Worker process: `node worker.js`. The Worker does not set `PORT`, `ENABLE_BULL_IN_WEB`, `ENABLE_SCHEDULED_JOBS`, or `PUPPETEER_EXECUTABLE_PATH`. Both use the same `MONGODB_URI` (`authSource=admin&replicaSet=rs0&retryWrites=true`), the same `REDIS_URL`, and the same Object Storage block including `STORAGE_FORCE_PATH_STYLE=true`. Readiness is `GET /health/ready` with `REDIS_HEALTH_BLOCKS_READY=true`. Vault contents are in the OCI runbook. There is no production env template in git (`server/.env.example` is the development template).

## Frontend (Vercel)

1. **Project root:** `client/`.
2. **Build:** `npm run build` (default for Vite).
3. **Domains:** connect `app.arivusystems.com` in the Vercel project.
4. **API routing:** `client/vercel.json` rewrites `/api/*` to `https://api.arivusystems.com/…` and matches the same **portal** API prefixes as the Vite dev proxy. If your real API host differs, **edit the destinations** in that file (or set equivalent rewrites in the Vercel dashboard).
5. **Split API host without rewrites:** set `VITE_API_ORIGIN=https://api.yourdomain.com` at build time. The app applies this via `getApiUrlForFetch` / the fetch shim in `main.ts` for `/api` and `/portal` API paths. Keep `CORS_ORIGINS` on the API in sync.
6. **Sentry + PostHog:** set the `VITE_*` variables in Vercel for **Production**; source maps are enabled in Vite for upload to Sentry (configure release + auth token in your CI or Sentry project).

## DNS

- `app.arivusystems.com` stays on Vercel.
- `api.arivusystems.com` is an A record to the OCI load balancer public IP.

## See also (internal beta / UAT)

- [UAT_DEV_ENVIRONMENT.md](./UAT_DEV_ENVIRONMENT.md) — `dev.arivusystems.com` isolation and env matrix  
- [INTERNAL_BETA_TEST_FLOWS.md](./INTERNAL_BETA_TEST_FLOWS.md) — structured teammate review  
- [MONITORING_OBSERVABILITY.md](./MONITORING_OBSERVABILITY.md) — Sentry + PostHog checks  
- [BACKUP_AND_ROLLBACK.md](./BACKUP_AND_ROLLBACK.md) — Atlas, S3, secrets, rollback

## Environment files

API and Worker env files are Vault secrets. First boot writes them to `/etc/arivu/api.env` and `/etc/arivu/worker.env`. The variable list is in [OCI_VM_DEPLOYMENT.md](./OCI_VM_DEPLOYMENT.md). Do not commit those files.

## CI/CD (next step)

- Add a workflow that: installs dependencies, runs `client` `npm run type-check` / `npm run test`, `server` unit tests, and (optionally) `npm run security:check` in `server`. The app stays on Vercel. API and Worker deploys are a new instance configuration and a one-at-a-time instance replacement, in [OCI_VM_DEPLOYMENT.md](./OCI_VM_DEPLOYMENT.md).

## npm cache / install issues

If `npm install` fails with EACCES on the global cache, run `sudo chown -R "$(whoami)" ~/.npm` once, or use a project-local cache: `npm install --cache .npm-cache`.
