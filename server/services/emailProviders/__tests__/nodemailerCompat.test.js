'use strict';

/**
 * nodemailer regression coverage against an in-process fake SMTP server (no real mail is sent).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');

process.env.TENANT_SECRET_ENCRYPTION_KEY = process.env.TENANT_SECRET_ENCRYPTION_KEY || 'test-only-tenant-secret-key';

const {
  verifySmtpCredentials,
  sendViaMailboxSmtp,
  classifySmtpError,
  VERIFY_STATUS
} = require('../../mailboxSmtpService');
const { encryptTenantSecret } = require('../../../utils/tenantSecretCrypto');
const { buildMimeMessage, sendRawMessage } = require('../../../platform/communication/providers/gmailSendProvider');

const VALID_USER = 'agent@example.test';
const VALID_PASS = 'correct-app-password';

function startFakeSmtpServer() {
  const sessions = [];
  const server = net.createServer((socket) => {
    const session = { commands: [], data: '', authUser: null };
    sessions.push(session);
    let buffer = '';
    let inData = false;
    let pendingLoginUser = null;
    let loginStep = null;

    const reply = (line) => socket.write(`${line}\r\n`);
    const checkAuth = (user, pass) => {
      if (user === VALID_USER && pass === VALID_PASS) {
        session.authUser = user;
        reply('235 2.7.0 Authentication successful');
      } else {
        reply('535 5.7.8 Authentication credentials invalid');
      }
    };

    reply('220 fake.smtp.test ESMTP');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        if (inData) {
          if (line === '.') {
            inData = false;
            reply('250 2.0.0 queued');
          } else {
            session.data += `${line.startsWith('..') ? line.slice(1) : line}\n`;
          }
          continue;
        }
        if (loginStep === 'user') {
          pendingLoginUser = Buffer.from(line, 'base64').toString();
          loginStep = 'pass';
          reply('334 UGFzc3dvcmQ6');
          continue;
        }
        if (loginStep === 'pass') {
          loginStep = null;
          checkAuth(pendingLoginUser, Buffer.from(line, 'base64').toString());
          continue;
        }

        session.commands.push(line);
        const verb = line.split(' ')[0].toUpperCase();
        if (verb === 'EHLO') {
          socket.write('250-fake.smtp.test\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        } else if (verb === 'AUTH') {
          const [, mech, initial] = line.split(' ');
          if (mech.toUpperCase() === 'PLAIN') {
            const [, user, pass] = Buffer.from(initial || '', 'base64').toString().split('\0');
            checkAuth(user, pass);
          } else {
            loginStep = 'user';
            reply('334 VXNlcm5hbWU6');
          }
        } else if (verb === 'MAIL' || verb === 'RCPT' || verb === 'RSET' || verb === 'NOOP') {
          reply('250 2.1.0 OK');
        } else if (verb === 'DATA') {
          inData = true;
          reply('354 End data with <CR><LF>.<CR><LF>');
        } else if (verb === 'QUIT') {
          reply('221 2.0.0 Bye');
          socket.end();
        } else {
          reply('502 5.5.2 Command not recognized');
        }
      }
    });
    socket.on('error', () => {});
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, sessions, port: server.address().port }));
  });
}

let smtp;

before(async () => {
  smtp = await startFakeSmtpServer();
});

after(() => new Promise((resolve) => smtp.server.close(resolve)));

describe('mailboxSmtpService with nodemailer', () => {
  it('verifySmtpCredentials reports CONNECTED for valid credentials', async () => {
    const result = await verifySmtpCredentials(
      { host: '127.0.0.1', port: smtp.port, secure: false },
      VALID_USER,
      VALID_PASS
    );
    assert.deepEqual(result, { ok: true, status: VERIFY_STATUS.CONNECTED });
  });

  it('verifySmtpCredentials classifies a 535 as INVALID_CREDENTIALS', async () => {
    const result = await verifySmtpCredentials(
      { host: '127.0.0.1', port: smtp.port, secure: false },
      VALID_USER,
      'wrong-password'
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, VERIFY_STATUS.INVALID_CREDENTIALS);
    assert.ok(!result.error.includes('wrong-password'));
  });

  it('verifySmtpCredentials classifies a reset connection as NETWORK_ERROR', async () => {
    // Keep the port bound: a released port can be reused by parallel test processes.
    const resetting = net.createServer((socket) => socket.resetAndDestroy());
    await new Promise((resolve) => resetting.listen(0, '127.0.0.1', resolve));
    const { port } = resetting.address();

    try {
      const result = await verifySmtpCredentials({ host: '127.0.0.1', port, secure: false }, VALID_USER, VALID_PASS);
      assert.equal(result.ok, false);
      assert.equal(result.status, VERIFY_STATUS.NETWORK_ERROR);
    } finally {
      await new Promise((resolve) => resetting.close(resolve));
    }
  });

  it('does not read a port containing 534/535 as an auth failure', () => {
    const err = Object.assign(new Error('connect ECONNRESET 127.0.0.1:45351'), { code: 'ESOCKET' });
    assert.equal(classifySmtpError(err), VERIFY_STATUS.NETWORK_ERROR);
    const authErr = Object.assign(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'), {
      code: 'EAUTH'
    });
    assert.equal(classifySmtpError(authErr), VERIFY_STATUS.INVALID_CREDENTIALS);
  });

  it('verifySmtpCredentials classifies a closed connection as NETWORK_ERROR', async () => {
    const closing = net.createServer((socket) => socket.end());
    await new Promise((resolve) => closing.listen(0, '127.0.0.1', resolve));
    const { port } = closing.address();

    try {
      const result = await verifySmtpCredentials({ host: '127.0.0.1', port, secure: false }, VALID_USER, VALID_PASS);
      assert.equal(result.ok, false);
      assert.equal(result.status, VERIFY_STATUS.NETWORK_ERROR);
    } finally {
      await new Promise((resolve) => closing.close(resolve));
    }
  });

  it('sendViaMailboxSmtp delivers threaded HTML mail with attachments', async () => {
    const before = smtp.sessions.length;
    const mailbox = {
      emailAddress: VALID_USER,
      smtpOutboundProvider: 'custom',
      smtpOutboundHost: '127.0.0.1',
      smtpOutboundPort: smtp.port,
      smtpOutboundSecure: false,
      smtpOutboundEncryptedAppPassword: encryptTenantSecret(VALID_PASS),
      smtpOutboundFromName: 'Support "Desk"'
    };
    const doc = {
      toAddresses: ['customer@example.test'],
      ccAddresses: ['cc@example.test'],
      bccAddresses: ['audit@example.test'],
      subject: 'Re: Order #42',
      body: '<p>Hello <b>there</b></p>',
      messageId: '<reply-1@arivu.test>',
      inReplyTo: '<orig-1@example.test>',
      references: '<orig-1@example.test>'
    };

    const result = await sendViaMailboxSmtp(doc, mailbox, {
      replyTo: 'support@example.test',
      attachments: [{ filename: 'quote.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }]
    });

    assert.equal(result.success, true);
    assert.equal(result.messageId, '<reply-1@arivu.test>');

    const session = smtp.sessions[smtp.sessions.length - 1];
    assert.ok(smtp.sessions.length > before);
    assert.equal(session.authUser, VALID_USER);
    assert.ok(session.commands.includes(`MAIL FROM:<${VALID_USER}>`));
    const rcpts = session.commands.filter((c) => c.startsWith('RCPT TO:'));
    assert.deepEqual(rcpts.sort(), [
      'RCPT TO:<audit@example.test>',
      'RCPT TO:<cc@example.test>',
      'RCPT TO:<customer@example.test>'
    ]);

    const data = session.data;
    assert.match(data, /^From: Support Desk <agent@example\.test>$/m);
    assert.match(data, /^Subject: Re: Order #42$/m);
    assert.match(data, /^Message-ID: <reply-1@arivu\.test>$/m);
    assert.match(data, /^In-Reply-To: <orig-1@example\.test>$/m);
    assert.match(data, /^References: <orig-1@example\.test>$/m);
    assert.match(data, /^Reply-To: support@example\.test$/m);
    assert.doesNotMatch(data, /^Bcc:/m);
    assert.match(data, /Content-Type: text\/plain/);
    assert.match(data, /Content-Type: text\/html/);
    assert.match(data, /filename=quote\.pdf/);
  });

  it('sendViaMailboxSmtp returns a failure result on auth rejection', async () => {
    const result = await sendViaMailboxSmtp(
      { toAddresses: ['customer@example.test'], subject: 'x', body: 'x' },
      {
        emailAddress: VALID_USER,
        smtpOutboundProvider: 'custom',
        smtpOutboundHost: '127.0.0.1',
        smtpOutboundPort: smtp.port,
        smtpOutboundEncryptedAppPassword: encryptTenantSecret('bad-password')
      }
    );
    assert.equal(result.success, false);
  });
});

describe('gmailSendProvider raw MIME (nodemailer/lib/mail-composer)', () => {
  it('builds a MIME buffer with threading headers, UTF-8 subject and attachments', async () => {
    const mime = await buildMimeMessage({
      from: 'Agent <agent@example.test>',
      to: ['a@example.test', ' ', 'b@example.test'],
      cc: 'c@example.test',
      subject: 'Héllo ✓',
      html: '<p>Hi</p>',
      text: 'Hi',
      inReplyTo: '<orig@example.test>',
      references: '<orig@example.test>',
      messageId: '<new@arivu.test>',
      attachments: [{ filename: 'a.txt', content: Buffer.from('attachment-body') }]
    });

    assert.ok(Buffer.isBuffer(mime));
    const text = mime.toString('utf8');
    assert.match(text, /^From: Agent <agent@example\.test>$/m);
    assert.match(text, /^To: a@example\.test, b@example\.test$/m);
    assert.match(text, /^Cc: c@example\.test$/m);
    assert.match(text, /^Subject: =\?UTF-8\?Q\?H=C3=A9llo_=E2=9C=93\?=$/m);
    assert.match(text, /^Message-ID: <new@arivu\.test>$/m);
    assert.match(text, /^In-Reply-To: <orig@example\.test>$/m);
    assert.match(text, /^Content-Type: multipart\/mixed;/m);
    assert.ok(text.includes(Buffer.from('attachment-body').toString('base64')));
  });

  it('keeps the Bcc header so the Gmail API delivers to Bcc recipients', async () => {
    const mime = await buildMimeMessage({
      from: 'agent@example.test',
      to: ['a@example.test'],
      bcc: ['audit@example.test', 'manager@example.test'],
      subject: 'x',
      text: 'x'
    });
    assert.match(mime.toString('utf8'), /^Bcc: audit@example\.test, manager@example\.test$/m);
  });

  it('omits the Bcc header when there are no Bcc recipients', async () => {
    const mime = await buildMimeMessage({ from: 'agent@example.test', to: ['a@example.test'], bcc: [' '], subject: 'x', text: 'x' });
    assert.doesNotMatch(mime.toString('utf8'), /^Bcc:/m);
  });

  it('sendRawMessage sends base64url MIME with the thread id', async () => {
    const calls = [];
    const gmail = {
      users: {
        messages: {
          send: async (req) => {
            calls.push(req);
            return { data: { id: 'g-1', threadId: 't-9' } };
          }
        }
      }
    };
    const result = await sendRawMessage({
      gmail,
      from: 'agent@example.test',
      to: ['a@example.test'],
      subject: 'Hello',
      text: 'Body',
      threadId: ' t-9 '
    });

    assert.deepEqual(result, {
      success: true,
      provider: 'gmail',
      messageId: 'g-1',
      threadId: 't-9',
      providerMessageKey: 'gmail:g-1'
    });
    assert.equal(calls[0].userId, 'me');
    assert.equal(calls[0].requestBody.threadId, 't-9');
    assert.doesNotMatch(calls[0].requestBody.raw, /[+/=]/);
    const decoded = Buffer.from(calls[0].requestBody.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    assert.match(decoded, /^Subject: Hello$/m);
  });

  it('sendRawMessage maps Gmail API failures to error codes', async () => {
    const gmail = {
      users: { messages: { send: async () => { throw Object.assign(new Error('Insufficient Permission'), { code: 403 }); } } }
    };
    const result = await sendRawMessage({ gmail, from: 'a@example.test', to: ['b@example.test'], subject: 'x', text: 'x' });
    assert.equal(result.success, false);
    assert.equal(result.code, 'GMAIL_SEND_SCOPE_REQUIRED');
  });
});
