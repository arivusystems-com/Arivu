#!/usr/bin/env node
'use strict';

/**
 * Staging smoke test for a deployed Arivu API + worker. Node >= 22, no dependencies.
 * Token values are never printed. Exit code 1 when any check fails.
 */

const crypto = require('crypto');

const USAGE = `
Usage:
  SMOKE_BASE_URL=https://api.staging.example.com node scripts/stagingSmokeTest.js

Required:
  SMOKE_BASE_URL          API origin (https only unless SMOKE_ALLOW_HTTP=1). Use staging, never production.

Optional (checks are skipped when inputs are missing):
  SMOKE_HEALTH_TOKEN      Value of HEALTH_DETAILS_TOKEN on the server (tests 401 + correct-token paths).
  SMOKE_METRICS_TOKEN     Value of MAILROOM_METRICS_TOKEN on the server.
  SMOKE_JWT               Bearer token of a staging test user (Sales app, templates:render, imports:create).
  SMOKE_TEMPLATE_ID       Content template id to render as PDF (output is not persisted).
  SMOKE_SEND_EMAIL=1      Opt in to sending ONE real email (requires the two addresses below).
  SMOKE_EMAIL_TO          Visible recipient mailbox you can check.
  SMOKE_EMAIL_BCC         Different Bcc mailbox you can check.
  SMOKE_MAILBOX_ID        Connected Gmail mailbox id to send from (exercises the Gmail API Bcc path).
  SMOKE_TIMEOUT_MS        Per-request timeout (default 20000).
  SMOKE_EMAIL_WAIT_MS     How long to wait for the worker to send (default 120000).
`;

const env = process.env;
const BASE_URL = String(env.SMOKE_BASE_URL || '').trim().replace(/\/+$/, '');
const TIMEOUT_MS = Number(env.SMOKE_TIMEOUT_MS) || 20000;
const EMAIL_WAIT_MS = Number(env.SMOKE_EMAIL_WAIT_MS) || 120000;
const RUN_ID = `smoke-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;

const CSV_FIXTURE = [
  '\uFEFFName,Email,Note',
  'Ada Lovelace,ada@example.com,"Analyst, first"',
  'Alan Turing,alan@example.com,"Says ""hello"""',
  'Grace Hopper,grace@example.com,'
].join('\r\n') + '\r\n';

const results = [];

function record(status, name, detail = '') {
  results.push({ status, name });
  console.log(`${status.padEnd(6)} ${name}${detail ? ` — ${detail}` : ''}`);
}
const pass = (name, detail) => record('PASS', name, detail);
const fail = (name, detail) => record('FAIL', name, detail);
const warn = (name, detail) => record('WARN', name, detail);
const skip = (name, detail) => record('SKIP', name, detail);
const manual = (name, detail) => record('MANUAL', name, detail);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', headers = {}, body, jwt } = {}) {
  const finalHeaders = { ...headers };
  if (jwt) finalHeaders.Authorization = `Bearer ${jwt}`;
  let payload = body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const started = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: payload,
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, headers: res.headers, text, json, ms: Date.now() - started };
}

function describeError(r) {
  const msg = r.json?.message || r.text.slice(0, 200);
  if (r.status === 401) return `HTTP 401 (JWT rejected or expired): ${msg}`;
  if (r.status === 403) return `HTTP 403 (test user lacks permission or app access): ${msg}`;
  return `HTTP ${r.status}: ${msg}`;
}

async function check(name, fn) {
  try {
    await fn();
  } catch (err) {
    fail(name, err?.name === 'TimeoutError' ? `timed out after ${TIMEOUT_MS}ms` : err.message);
  }
}

async function checkLiveness() {
  const r = await request('/health/live');
  if (r.status === 200 && r.json?.liveness === true) pass('liveness /health/live', `${r.ms}ms`);
  else fail('liveness /health/live', `HTTP ${r.status}`);
}

async function checkReadiness() {
  const r = await request('/health/ready');
  const dbConnected = r.json?.database?.connected === true;
  const redis = r.json?.redis || {};
  if (r.status === 200) pass('readiness /health/ready (public, for load balancer)', `${r.ms}ms`);
  else fail('readiness /health/ready (public, for load balancer)', `HTTP ${r.status}`);

  if (dbConnected) pass('MongoDB connected');
  else fail('MongoDB connected', `database.state=${r.json?.database?.state}`);

  if (!redis.configured) fail('Redis connected', 'Redis not configured; the worker and email queue require it');
  else if (redis.ok) pass('Redis connected');
  else fail('Redis connected', 'redis.ok=false (set SMOKE_HEALTH_TOKEN to see the error)');
}

/**
 * With a token: no token and a wrong token must get 401, the correct token 200.
 * Without a token: the server must answer 404 (token unset in production) or 401 (token set);
 * 200 means the endpoint is publicly exposed.
 */
async function checkOperatorEndpoint({ name, path, token, header, validate }) {
  const anon = await request(path);
  if (!token) {
    if (anon.status === 404) return pass(`${name} hidden (token unset on server)`, 'HTTP 404');
    if (anon.status === 401) {
      return warn(`${name} protected (token set on server)`, 'HTTP 401; supply the token to test the correct-token path');
    }
    return fail(`${name} must not be public`, `expected 404 or 401, got HTTP ${anon.status}`);
  }

  if (anon.status === 401) pass(`${name} rejects missing token`, 'HTTP 401');
  else fail(`${name} rejects missing token`, `expected 401, got HTTP ${anon.status}`);

  const wrong = await request(path, { headers: { [header]: `wrong-${RUN_ID}` } });
  if (wrong.status === 401) pass(`${name} rejects wrong token`, 'HTTP 401');
  else fail(`${name} rejects wrong token`, `expected 401, got HTTP ${wrong.status}`);

  const ok = await request(path, { headers: { [header]: token } });
  if (ok.status !== 200) return fail(`${name} accepts correct token`, `HTTP ${ok.status}`);
  const problem = validate(ok);
  if (problem) fail(`${name} accepts correct token`, problem);
  else pass(`${name} accepts correct token`, `${ok.ms}ms`);
}

async function checkPdf(jwt) {
  const name = 'PDF render (Puppeteer + Chrome)';
  const templateId = String(env.SMOKE_TEMPLATE_ID || '').trim();
  if (!jwt || !templateId) return skip(name, 'set SMOKE_JWT and SMOKE_TEMPLATE_ID');
  const r = await request(`/api/templates/${encodeURIComponent(templateId)}/render`, {
    method: 'POST',
    jwt,
    body: { outputFormat: 'pdf', persistOutput: false }
  });
  if (r.status !== 200) return fail(name, describeError(r));
  const bytes = r.json?.data?.buffer?.data;
  const magic = Array.isArray(bytes) ? Buffer.from(bytes.slice(0, 5)).toString('latin1') : '';
  if (magic.startsWith('%PDF')) pass(name, `${r.json.data.fileSizeBytes} bytes in ${r.ms}ms`);
  else fail(name, 'response did not contain a PDF document');
}

async function checkCsv(jwt) {
  const name = 'CSV import staging (csv-parse)';
  if (!jwt) return skip(name, 'set SMOKE_JWT');
  const form = new FormData();
  form.append('file', new Blob([CSV_FIXTURE], { type: 'text/csv' }), `${RUN_ID}.csv`);
  const r = await request('/api/csv/staging', { method: 'POST', jwt, body: form });
  if (r.status !== 201) return fail(name, describeError(r));

  const data = r.json?.data || {};
  const problems = [];
  if (JSON.stringify(data.headers) !== JSON.stringify(['Name', 'Email', 'Note'])) {
    problems.push(`headers=${JSON.stringify(data.headers)} (BOM must be stripped)`);
  }
  if (data.totalRows !== 3) problems.push(`totalRows=${data.totalRows}, expected 3`);
  const [first, second] = data.preview || [];
  if (first?.Note !== 'Analyst, first') problems.push(`quoted comma parsed as ${JSON.stringify(first?.Note)}`);
  if (second?.Note !== 'Says "hello"') problems.push(`escaped quotes parsed as ${JSON.stringify(second?.Note)}`);
  if (problems.length) fail(name, problems.join('; '));
  else pass(name, `stagingId ${data.stagingId} (temporary upload, no records imported)`);
}

async function checkEmailAndWorker(jwt) {
  const to = String(env.SMOKE_EMAIL_TO || '').trim();
  const bcc = String(env.SMOKE_EMAIL_BCC || '').trim();
  if (env.SMOKE_SEND_EMAIL !== '1' || !jwt || !to || !bcc) {
    skip('email send', 'set SMOKE_SEND_EMAIL=1, SMOKE_JWT, SMOKE_EMAIL_TO, SMOKE_EMAIL_BCC (+ SMOKE_MAILBOX_ID)');
    return skip('worker execution', 'verified through the email-send job');
  }
  if (to.toLowerCase() === bcc.toLowerCase()) {
    return fail('email send', 'SMOKE_EMAIL_TO and SMOKE_EMAIL_BCC must be different mailboxes');
  }

  const subject = `Arivu staging smoke ${RUN_ID}`;
  const payload = {
    standalone: true,
    to: [to],
    bcc: [bcc],
    subject,
    body: `<p>Arivu staging smoke test ${RUN_ID}.</p><p>This copy must reach both the To and the Bcc mailbox.</p>`
  };
  if (env.SMOKE_MAILBOX_ID) payload.mailboxId = String(env.SMOKE_MAILBOX_ID).trim();

  const r = await request('/api/communications/email', {
    method: 'POST',
    jwt,
    headers: { 'X-Idempotency-Key': RUN_ID },
    body: payload
  });
  if (r.status !== 200 || r.json?.success !== true) return fail('email send accepted', describeError(r));
  const communicationId = r.json.data?._id;
  const queued = r.json.queued === true;
  pass('email send accepted', `communication ${communicationId}${queued ? ', queued for worker' : ''}`);
  if (!queued) warn('worker execution', 'API sent synchronously (Redis queue unavailable); worker not exercised');

  const deadline = Date.now() + EMAIL_WAIT_MS;
  let status = 'sending';
  let deliveryError = null;
  while (Date.now() < deadline) {
    const s = await request(`/api/communications/${communicationId}/delivery-status`, { jwt });
    status = String(s.json?.data?.status || status).toLowerCase();
    deliveryError = s.json?.data?.deliveryError || null;
    if (status !== 'sending' && status !== 'scheduled') break;
    await sleep(3000);
  }

  if (status === 'sending') {
    return fail(queued ? 'worker execution' : 'email provider accepted message',
      `still "sending" after ${EMAIL_WAIT_MS / 1000}s; check the worker process and Redis`);
  }
  if (!['sent', 'delivered', 'opened'].includes(status)) {
    return fail('email provider accepted message', `status=${status}${deliveryError ? `: ${deliveryError}` : ''}`);
  }
  if (queued) pass('worker execution', `email-send job processed (status=${status})`);
  pass('email provider accepted message', `status=${status}`);

  manual('Bcc delivery (inbox check)',
    `confirm "${subject}" arrived in BOTH ${to} and ${bcc}, and that ${bcc} is absent from the headers of the copy at ${to}`);
}

async function main() {
  if (!BASE_URL) {
    console.error(USAGE);
    process.exit(2);
  }
  if (!BASE_URL.startsWith('https://') && env.SMOKE_ALLOW_HTTP !== '1') {
    console.error('SMOKE_BASE_URL must use https:// (tokens are sent); set SMOKE_ALLOW_HTTP=1 for a local target.');
    process.exit(2);
  }

  const jwt = String(env.SMOKE_JWT || '').trim();
  console.log(`Arivu staging smoke ${RUN_ID} against ${BASE_URL}\n`);

  await check('liveness /health/live', checkLiveness);
  await check('readiness /health/ready', checkReadiness);
  await check('/health/status access control', () => checkOperatorEndpoint({
    name: '/health/status',
    path: '/health/status',
    token: String(env.SMOKE_HEALTH_TOKEN || '').trim(),
    header: 'X-Health-Token',
    validate: (r) => {
      if (r.json?.database?.connected !== true) return 'database.connected is not true';
      if (r.json?.database?.host !== undefined) return 'response leaks database host';
      return null;
    }
  }));
  await check('/health/mailroom-metrics access control', () => checkOperatorEndpoint({
    name: '/health/mailroom-metrics',
    path: '/health/mailroom-metrics',
    token: String(env.SMOKE_METRICS_TOKEN || '').trim(),
    header: 'X-Metrics-Token',
    validate: (r) => (String(r.headers.get('content-type') || '').startsWith('text/plain')
      ? null
      : `unexpected content-type ${r.headers.get('content-type')}`)
  }));
  await check('PDF render (Puppeteer + Chrome)', () => checkPdf(jwt));
  await check('CSV import staging (csv-parse)', () => checkCsv(jwt));
  await check('email send', () => checkEmailAndWorker(jwt));

  const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  console.log(`\nSummary: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  process.exit(counts.FAIL ? 1 : 0);
}

main();
