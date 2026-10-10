'use strict';

const emailProviderGateway = require('../platform/communication/providers/emailProviderGateway');
const { escapeHtml, buildEmailShell } = require('../utils/appointmentEmailUtils');

const NUDGE_COPY = {
  1: {
    subject: 'Finish setting up your Arivu workspace',
    title: 'Your workspace is almost ready',
    body: 'Take a few minutes to complete setup — choose your focus, add your first contact, and explore your apps.',
    cta: 'Continue setup'
  },
  3: {
    subject: 'Add your first contact to get started',
    title: 'Your CRM is waiting for its first record',
    body: 'You have not added a contact yet. Create one or import a CSV to see how Arivu works for your team.',
    cta: 'Open workspace'
  },
  7: {
    subject: 'Invite a teammate to your workspace',
    title: 'Collaboration works better together',
    body: 'You are the only active user in your workspace. Invite a teammate to share deals, tasks, and support cases.',
    cta: 'Invite someone'
  }
};

function displayName(user) {
  const full = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return full || user?.username || user?.email || 'there';
}

function buildAppUrl(path) {
  const { resolveClientUrl } = require('../utils/clientUrl');
  const base = resolveClientUrl([process.env.CLIENT_URL, process.env.APP_URL]);
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildTrialNudgeEmailContent({ day, user, organizationName, ctaPath }) {
  const copy = NUDGE_COPY[day];
  if (!copy) return null;

  const name = displayName(user);
  const org = organizationName || 'your workspace';
  const ctaUrl = buildAppUrl(ctaPath);

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(name)}, here is a quick nudge to help you get more from ${escapeHtml(org)}.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
      ${escapeHtml(copy.body)}
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
        ${escapeHtml(copy.cta)}
      </a>
    </p>`;

  const text = [
    `Hi ${name},`,
    '',
    copy.body,
    '',
    `${copy.cta}: ${ctaUrl}`
  ].join('\n');

  return {
    subject: copy.subject,
    text,
    html: buildEmailShell({
      title: copy.title,
      bodyHtml,
      accentColor: '#4f46e5'
    })
  };
}

async function sendTrialNudgeEmail({ day, user, organizationName, ctaPath }) {
  if (!emailProviderGateway.isSystemConfigured()) {
    return { success: false, skipped: true, reason: 'system_email_not_configured' };
  }

  const content = buildTrialNudgeEmailContent({ day, user, organizationName, ctaPath });
  if (!content || !user?.email) {
    return { success: false, skipped: true, reason: 'invalid_payload' };
  }

  return emailProviderGateway.sendSystemEmail({
    to: user.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
  });
}

module.exports = {
  sendTrialNudgeEmail,
  buildTrialNudgeEmailContent,
  NUDGE_COPY
};
