# Inbound Parser ↔ Arivu CRM integration

**Status:** Implemented (Gmail OAuth/sync and legacy MIME webhook are **off** by default).

Operator docs for the parser service:

- [CRM_WEBHOOK_INTEGRATION_GUIDE.md](../../docs/CRM_WEBHOOK_INTEGRATION_GUIDE.md) — `email.received` webhook contract
- [CRM_PROVISIONING_API.md](../../docs/CRM_PROVISIONING_API.md) — register tenants/mailboxes in parser

## What is disabled (avoid CASA / Google API review)

| Feature | Env | Default |
|---------|-----|---------|
| Gmail OAuth + inbox sync + Gmail API send | `ENABLE_GMAIL_INTEGRATION=false` | **off** |
| Apps Script / MIME → `POST /api/webhooks/email/inbound` | `ENABLE_LEGACY_MIME_INBOUND_WEBHOOK=false` | **off** |
| Gmail Pub/Sub push | (same as Gmail integration) | **off** |

## What stays on

| Feature | Notes |
|---------|--------|
| **Resend / tenant SMTP** | CRM outbound (`outboundEmailSendService` → platform provider) |
| **OCI** | System mail (OTP, notifications) |
| **Workspace Inbox UI** | Threads from parser-synced `Communication` rows |
| **Mailboxes** (`kind: group`) | Virtual mailboxes; show parser `routingAddress` when provisioned |

## Two servers — what URL goes where

| Server | Setting | Example |
|--------|---------|---------|
| **Inbound Parser** | `CRM_WEBHOOK_URL` | `https://api.arivusystems.com/api/webhooks/arivu/inbound-email` |
| **Inbound Parser** | `CRM_WEBHOOK_SECRET` | Same secret saved in CRM Control Plane |
| **Inbound Parser** | `CRM_API_KEY` | Same key CRM uses to call parser provisioning |
| **CRM (this app)** | Control Plane → **Inbound Parser** | Parser API base URL, CRM public API base URL, secrets |

Tenants **never** see parser hostnames or API keys. They only see **`routingAddress`** on each mailbox after create.

## Platform admin UI (you only)

1. Open **Control Plane → Inbound Parser** (`/control/inbound-parser`).
2. Set **Parser API base URL** (parser server).
3. Set **CRM public API base URL** (this CRM API, for webhook copy-paste).
4. Save **Parser API key** and **Webhook HMAC secret** (match parser `.env`).
5. Enable integration and **Test parser connection**.

Env fallbacks (optional instead of UI):

```env
PARSER_API_BASE_URL=https://parser.arivusystems.com
CRM_PUBLIC_API_BASE_URL=https://api.arivusystems.com
PARSER_CRM_API_KEY=...
ARIVU_WEBHOOK_SECRET=...
INBOUND_PARSER_ENABLED=true
```

## Integration flow

```text
1. Platform admin configures parser URLs (Control Plane)
2. Tenant admin creates shared mailbox OR user creates personal mailbox
   → CRM POST parser /integrations/v1/mailboxes
   → routingAddress stored on Mailbox
3. User forwards support@ → routingAddress (Gmail/M365 — no Google API)
4. Parser ingests → POST CRM /api/webhooks/arivu/inbound-email (JSON + HMAC)
5. CRM fetches GET parser `/integrations/v1/messages/{messageId}` (Bearer `CRM_API_KEY`)
   → Communication in tenant DB (workspace inbox)
   → Helpdesk Case create/append via `helpdeskChannelIngestionService` (default; opt out personal with `PARSER_INBOUND_WORKSPACE_ONLY=true`)
```

## CRM endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/webhooks/arivu/inbound-email` | Parser `email.received` |
| `GET /api/webhooks/arivu/inbound-email/health` | Webhook readiness |
| `GET/PUT /api/platform/inbound-parser` | Platform admin config only |

Legacy path (disabled by default): `POST /api/webhooks/email/inbound`

## Local simulation (no remote parser)

For development when the parser cannot reach `localhost`:

```bash
cd server
npm run simulate:parser-inbound
npm run simulate:parser-inbound -- --enable-mailroom
npm run simulate:parser-inbound -- --http --crm-url http://localhost:3000
```

See `server/platform/mailroom/README.md` for options (`--from`, `--subject`, `--body`, `--org-id`, `--mailbox-id`).

### Local mailbox simulation (no remote parser)

```bash
cd server
npm run simulate:mailbox
npm run simulate:mailbox -- --kind group --label "Support"
```

Optional: `LOCAL_PARSER_PROVISION=true` in `server/.env` so **Settings → Mailboxes** UI provisioning also uses local routing addresses.

## Re-enable Gmail later

```env
ENABLE_GMAIL_INTEGRATION=true
ENABLE_GMAIL_INBOX_SYNC_SCHEDULER=true
```

See [WORKSPACE_INBOUND_WEBHOOK_SETUP.md](./WORKSPACE_INBOUND_WEBHOOK_SETUP.md) and [CRM_EMAIL_BLUEPRINT_ROADMAP.md](./CRM_EMAIL_BLUEPRINT_ROADMAP.md).
