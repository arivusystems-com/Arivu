/**
 * Gmail API outbound send (users.messages.send with raw MIME).
 * Requires OAuth scope https://www.googleapis.com/auth/gmail.send
 */

const MailComposer = require('nodemailer/lib/mail-composer');

function encodeRawMime(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function normalizeAddressField(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const list = value.map((v) => String(v || '').trim()).filter(Boolean);
    return list.length ? list : undefined;
  }
  const s = String(value).trim();
  return s || undefined;
}

/**
 * @param {object} options
 * @returns {Promise<Buffer>}
 */
async function buildMimeMessage(options) {
  const mail = new MailComposer({
    from: options.from,
    to: normalizeAddressField(options.to),
    cc: normalizeAddressField(options.cc),
    bcc: normalizeAddressField(options.bcc),
    subject: options.subject || '',
    html: options.html || undefined,
    text: options.text || undefined,
    replyTo: options.replyTo || undefined,
    inReplyTo: options.inReplyTo || undefined,
    references: options.references || undefined,
    messageId: options.messageId || undefined,
    attachments: options.attachments?.length ? options.attachments : undefined
  });
  const message = mail.compile();
  // Gmail API delivers to the Bcc header and strips it before delivery; without it Bcc is lost.
  message.keepBcc = true;
  return message.build();
}

function classifyGmailSendError(err) {
  const msg = err?.message || String(err);
  const status = err?.code || err?.response?.status;
  if (
    status === 403
    || /insufficient.*scope/i.test(msg)
    || /Insufficient Permission/i.test(msg)
  ) {
    return 'GMAIL_SEND_SCOPE_REQUIRED';
  }
  if (/invalid_grant|token has been expired|revoked/i.test(msg)) {
    return 'GMAIL_OAUTH_REVOKED';
  }
  return 'GMAIL_SEND_FAILED';
}

/**
 * @param {object} params
 * @param {import('googleapis').gmail_v1.Gmail} params.gmail
 * @param {string} params.from
 * @param {string[]} params.to
 * @param {string[]} [params.cc]
 * @param {string[]} [params.bcc]
 * @param {string} params.subject
 * @param {string} [params.html]
 * @param {string} [params.text]
 * @param {string} [params.replyTo]
 * @param {string} [params.inReplyTo]
 * @param {string} [params.references]
 * @param {string} [params.messageId]
 * @param {Array<{ filename: string, content: Buffer }>} [params.attachments]
 * @param {string} [params.threadId] — Gmail thread id for replies
 */
async function sendRawMessage(params) {
  const { gmail } = params;
  if (!gmail) {
    return {
      success: false,
      provider: 'gmail',
      error: 'Gmail client is required',
      code: 'GMAIL_CLIENT_MISSING'
    };
  }

  try {
    const mime = await buildMimeMessage(params);
    const raw = encodeRawMime(mime);
    const requestBody = { raw };
    if (params.threadId) {
      requestBody.threadId = String(params.threadId).trim();
    }

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody
    });

    const id = res.data?.id ? String(res.data.id) : '';
    const threadId = res.data?.threadId ? String(res.data.threadId) : null;

    return {
      success: true,
      provider: 'gmail',
      messageId: id || null,
      threadId,
      providerMessageKey: id ? `gmail:${id}` : null
    };
  } catch (err) {
    const code = classifyGmailSendError(err);
    return {
      success: false,
      provider: 'gmail',
      error: err?.message || String(err),
      code
    };
  }
}

module.exports = {
  buildMimeMessage,
  encodeRawMime,
  sendRawMessage,
  classifyGmailSendError
};
