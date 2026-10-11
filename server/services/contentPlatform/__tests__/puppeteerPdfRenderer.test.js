'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createPuppeteerPdfRenderer,
  SYSTEM_CHROME_PATHS
} = require('../renderers/puppeteerPdfRenderer');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../../utils/contentPlatformErrors');

const unhandled = [];
const onUnhandled = (reason) => unhandled.push(reason);

function createLogger() {
  const warnings = [];
  return { warnings, warn: (msg) => warnings.push(String(msg)) };
}

function createFakePage({ pdfError = null, setContentError = null, closeError = null } = {}) {
  const page = {
    calls: { setContent: [], pdf: [], close: 0 },
    async setContent(html, opts) {
      page.calls.setContent.push({ html, opts });
      if (setContentError) throw setContentError;
    },
    async pdf(opts) {
      page.calls.pdf.push(opts);
      if (pdfError) throw pdfError;
      return new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    },
    async close() {
      page.calls.close += 1;
      if (closeError) throw closeError;
    }
  };
  return page;
}

function createFakeBrowser(pageOptions = {}) {
  const browser = new EventEmitter();
  browser.pages = [];
  browser.closed = 0;
  browser.newPageError = null;
  browser.newPage = async () => {
    if (browser.newPageError) throw browser.newPageError;
    const page = createFakePage(pageOptions);
    browser.pages.push(page);
    return page;
  };
  browser.close = async () => {
    browser.closed += 1;
  };
  return browser;
}

function createFakePuppeteer({ executablePath, launchError = null, pageOptions } = {}) {
  const puppeteer = {
    launchCalls: [],
    browsers: [],
    async launch(opts) {
      puppeteer.launchCalls.push(opts);
      if (launchError) throw launchError;
      const browser = createFakeBrowser(pageOptions);
      puppeteer.browsers.push(browser);
      return browser;
    }
  };
  if (executablePath !== undefined) puppeteer.executablePath = executablePath;
  return puppeteer;
}

function setup({ env = {}, platform = 'linux', executables = [], puppeteer, isExecutable } = {}) {
  const logger = createLogger();
  const fakePuppeteer = puppeteer || createFakePuppeteer();
  let loadCount = 0;
  const renderer = createPuppeteerPdfRenderer({
    env,
    platform,
    logger,
    loadPuppeteer: async () => {
      loadCount += 1;
      return fakePuppeteer;
    },
    isExecutable: isExecutable || (async (p) => executables.includes(p))
  });
  return { renderer, logger, puppeteer: fakePuppeteer, loadCount: () => loadCount };
}

async function assertRenderError(promise, messagePattern) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ContentPlatformError);
    assert.equal(error.code, CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED);
    assert.equal(error.statusCode, 503);
    assert.match(error.message, messagePattern);
    return true;
  });
}

before(() => process.on('unhandledRejection', onUnhandled));
after(() => process.off('unhandledRejection', onUnhandled));

describe('puppeteerPdfRenderer executable resolution', () => {
  it('uses an explicit PUPPETEER_EXECUTABLE_PATH that exists without loading puppeteer', async () => {
    const ctx = setup({
      env: { PUPPETEER_EXECUTABLE_PATH: '/opt/chrome/chrome' },
      executables: ['/opt/chrome/chrome', SYSTEM_CHROME_PATHS.linux[0]]
    });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), '/opt/chrome/chrome');
    assert.equal(ctx.loadCount(), 0);
  });

  it('uses CHROME_PATH when PUPPETEER_EXECUTABLE_PATH is unset', async () => {
    const ctx = setup({ env: { CHROME_PATH: '/opt/chromium' }, executables: ['/opt/chromium'] });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), '/opt/chromium');
  });

  it('warns and falls back when a configured path does not exist', async () => {
    const ctx = setup({
      env: { PUPPETEER_EXECUTABLE_PATH: '/missing/chrome' },
      executables: ['/usr/bin/chromium']
    });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), '/usr/bin/chromium');
    assert.equal(ctx.logger.warnings.length, 1);
    assert.match(ctx.logger.warnings[0], /PUPPETEER_EXECUTABLE_PATH.*\/missing\/chrome/);
  });

  it('reports a missing configured path in the not-found error', async () => {
    const ctx = setup({
      env: { CHROME_PATH: '/missing/chrome' },
      puppeteer: createFakePuppeteer({ executablePath: async () => '/cache/chrome' })
    });
    await assertRenderError(ctx.renderer.renderHtmlToPdf('<p>x</p>'), /CHROME_PATH=\/missing\/chrome/);
    assert.equal(ctx.puppeteer.launchCalls.length, 0);
  });

  it('checks standard system paths for the current platform in order', async () => {
    const checked = [];
    const ctx = setup({
      platform: 'linux',
      isExecutable: async (p) => {
        checked.push(p);
        return p === '/usr/bin/chromium-browser';
      }
    });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), '/usr/bin/chromium-browser');
    assert.deepEqual(checked, SYSTEM_CHROME_PATHS.linux.slice(0, 3));
    assert.equal(ctx.loadCount(), 0);
  });

  it('awaits the asynchronous puppeteer >= 25 executablePath()', async () => {
    const ctx = setup({
      executables: ['/cache/chrome/linux-1/chrome'],
      puppeteer: createFakePuppeteer({
        executablePath: () => new Promise((resolve) => setImmediate(resolve, '/cache/chrome/linux-1/chrome'))
      })
    });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), '/cache/chrome/linux-1/chrome');
  });

  it('still supports the synchronous puppeteer <= 24 executablePath()', async () => {
    const ctx = setup({
      executables: ['/cache/chrome'],
      puppeteer: createFakePuppeteer({ executablePath: () => '/cache/chrome' })
    });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), '/cache/chrome');
  });

  it('ignores a bundled path that is not installed', async () => {
    const ctx = setup({ puppeteer: createFakePuppeteer({ executablePath: async () => '/cache/not-downloaded' }) });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), null);
  });

  it('returns null when executablePath() rejects and surfaces the cause on render', async () => {
    const lookupError = Object.assign(new TypeError('The "path" argument must be of type string'), {
      code: 'ERR_INVALID_ARG_TYPE'
    });
    const ctx = setup({ puppeteer: createFakePuppeteer({ executablePath: async () => { throw lookupError; } }) });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), null);

    await assert.rejects(ctx.renderer.renderHtmlToPdf('<p>x</p>'), (error) => {
      assert.equal(error.code, CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED);
      assert.equal(error.cause, lookupError);
      assert.match(error.message, /Puppeteer browser lookup failed: The "path" argument/);
      return true;
    });
  });

  it('handles executablePath() throwing synchronously', async () => {
    const ctx = setup({ puppeteer: createFakePuppeteer({ executablePath: () => { throw new Error('no cache dir'); } }) });
    assert.equal(await ctx.renderer.resolveChromeExecutablePath(), null);
  });

  it('propagates unexpected filesystem errors instead of swallowing them', async () => {
    const ctx = setup({
      isExecutable: async () => {
        throw Object.assign(new Error('EIO: i/o error'), { code: 'EIO' });
      }
    });
    await assert.rejects(ctx.renderer.resolveChromeExecutablePath(), /EIO/);
  });

  it('propagates puppeteer dependency load failures', async () => {
    const renderer = createPuppeteerPdfRenderer({
      env: {},
      platform: 'linux',
      logger: createLogger(),
      isExecutable: async () => false,
      loadPuppeteer: async () => {
        throw new ContentPlatformError(CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED, 'PDF rendering dependency missing.', { statusCode: 503 });
      }
    });
    await assertRenderError(renderer.renderHtmlToPdf('<p>x</p>'), /dependency missing/);
  });
});

describe('puppeteerPdfRenderer default dependencies', () => {
  it('resolves through the installed puppeteer-core without leaking async errors', async () => {
    const renderer = createPuppeteerPdfRenderer({
      env: {},
      platform: 'none',
      logger: createLogger(),
      isExecutable: async () => false
    });
    assert.equal(await renderer.resolveChromeExecutablePath(), null);
  });

  it('installed puppeteer-core returns a Promise from executablePath()', async () => {
    const mod = await import('puppeteer-core');
    const puppeteer = mod.default || mod;
    const result = (() => {
      try {
        return puppeteer.executablePath();
      } catch (error) {
        return error;
      }
    })();
    if (result instanceof Promise) {
      await result.catch(() => {});
    }
    const { version } = require('puppeteer-core/package.json');
    if (Number(version.split('.')[0]) >= 25) {
      assert.ok(result instanceof Promise, `puppeteer-core@${version} executablePath() should return a Promise`);
    }
  });

  it('accepts executable files and rejects non-executable files', { skip: process.platform === 'win32' && 'POSIX permissions required' }, async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arivu-chrome-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const exe = path.join(dir, 'chrome');
    const plain = path.join(dir, 'not-exec');
    fs.writeFileSync(exe, '#!/bin/sh\n', { mode: 0o755 });
    fs.writeFileSync(plain, '', { mode: 0o644 });

    const loadPuppeteer = async () => createFakePuppeteer();
    const withExe = createPuppeteerPdfRenderer({ env: { CHROME_PATH: exe }, platform: 'none', logger: createLogger(), loadPuppeteer });
    assert.equal(await withExe.resolveChromeExecutablePath(), exe);

    const logger = createLogger();
    const withPlain = createPuppeteerPdfRenderer({ env: { CHROME_PATH: plain }, platform: 'none', logger, loadPuppeteer });
    assert.equal(await withPlain.resolveChromeExecutablePath(), null);
    const withDir = createPuppeteerPdfRenderer({ env: { CHROME_PATH: dir }, platform: 'none', logger, loadPuppeteer });
    assert.equal(await withDir.resolveChromeExecutablePath(), null);
    assert.equal(logger.warnings.length, 2);
  });
});

describe('puppeteerPdfRenderer rendering', () => {
  const CHROME = '/usr/bin/chromium';

  it('fails predictably without launching when no browser is available', async () => {
    const ctx = setup({ puppeteer: createFakePuppeteer({ executablePath: async () => '/cache/missing' }) });
    await assertRenderError(ctx.renderer.renderHtmlToPdf('<p>x</p>'), /Chrome is required for PDF rendering but was not found/);
    assert.equal(ctx.puppeteer.launchCalls.length, 0);
  });

  it('launches with the resolved path and preserves launch options', async () => {
    const ctx = setup({ executables: [CHROME] });
    await ctx.renderer.renderHtmlToPdf('<p>x</p>');
    assert.deepEqual(ctx.puppeteer.launchCalls, [{
      headless: true,
      executablePath: CHROME,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
    }]);
  });

  it('renders a PDF buffer with mapped page options and closes the page', async () => {
    const ctx = setup({ executables: [CHROME] });
    const buffer = await ctx.renderer.renderHtmlToPdf('<h1>Quote</h1>', { paperSize: 'A4', orientation: 'landscape' });
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.toString('latin1'), '%PDF');

    const [page] = ctx.puppeteer.browsers[0].pages;
    assert.deepEqual(page.calls.setContent, [{ html: '<h1>Quote</h1>', opts: { waitUntil: 'load' } }]);
    assert.deepEqual(page.calls.pdf, [{ printBackground: true, preferCSSPageSize: true, format: 'A4', landscape: true }]);
    assert.equal(page.calls.close, 1);
  });

  it('maps custom paper dimensions to millimetres', async () => {
    const ctx = setup({ executables: [CHROME] });
    await ctx.renderer.renderHtmlToPdf('<p>x</p>', { paperSize: 'Custom', dimensions: { width: 100, height: 150 } });
    assert.deepEqual(ctx.puppeteer.browsers[0].pages[0].calls.pdf, [{
      printBackground: true,
      preferCSSPageSize: true,
      width: '100mm',
      height: '150mm'
    }]);
  });

  it('wraps page failures and still closes the page', async () => {
    const ctx = setup({
      executables: [CHROME],
      puppeteer: createFakePuppeteer({ pageOptions: { pdfError: new Error('Target closed') } })
    });
    await assert.rejects(ctx.renderer.renderHtmlToPdf('<p>x</p>'), (error) => {
      assert.equal(error.code, CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED);
      assert.match(error.message, /^PDF rendering failed: Target closed$/);
      assert.equal(error.cause.message, 'Target closed');
      return true;
    });
    assert.equal(ctx.puppeteer.browsers[0].pages[0].calls.close, 1);
  });

  it('keeps the original render error when page.close() also fails', async () => {
    const ctx = setup({
      executables: [CHROME],
      puppeteer: createFakePuppeteer({
        pageOptions: { setContentError: new Error('navigation timeout'), closeError: new Error('already closed') }
      })
    });
    await assertRenderError(ctx.renderer.renderHtmlToPdf('<p>x</p>'), /navigation timeout/);
    assert.match(ctx.logger.warnings.join('\n'), /Failed to close page: already closed/);
  });

  it('wraps newPage() failures', async () => {
    const ctx = setup({ executables: [CHROME] });
    await ctx.renderer.renderHtmlToPdf('<p>warm</p>');
    ctx.puppeteer.browsers[0].newPageError = new Error('Protocol error');
    await assertRenderError(ctx.renderer.renderHtmlToPdf('<p>x</p>'), /PDF rendering failed: Protocol error/);
  });

  it('translates launch failures and retries on the next request', async () => {
    const launchError = new Error('spawn EACCES');
    const ctx = setup({ executables: [CHROME], puppeteer: createFakePuppeteer({ launchError }) });

    await assert.rejects(ctx.renderer.renderHtmlToPdf('<p>x</p>'), (error) => {
      assert.equal(error.code, CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED);
      assert.equal(error.statusCode, 503);
      assert.equal(error.message, 'Failed to launch Chrome for PDF rendering: spawn EACCES');
      assert.equal(error.cause, launchError);
      return true;
    });
    await assert.rejects(ctx.renderer.renderHtmlToPdf('<p>x</p>'), /Failed to launch Chrome/);
    assert.equal(ctx.puppeteer.launchCalls.length, 2);
  });

  it('shares a single browser launch across concurrent renders', async () => {
    const ctx = setup({ executables: [CHROME] });
    await Promise.all([
      ctx.renderer.renderHtmlToPdf('<p>1</p>'),
      ctx.renderer.renderHtmlToPdf('<p>2</p>'),
      ctx.renderer.renderHtmlToPdf('<p>3</p>')
    ]);
    assert.equal(ctx.puppeteer.launchCalls.length, 1);
    assert.equal(ctx.puppeteer.browsers[0].pages.length, 3);
  });

  it('relaunches after the browser disconnects', async () => {
    const ctx = setup({ executables: [CHROME] });
    await ctx.renderer.renderHtmlToPdf('<p>1</p>');
    ctx.puppeteer.browsers[0].emit('disconnected');
    await ctx.renderer.renderHtmlToPdf('<p>2</p>');
    assert.equal(ctx.puppeteer.launchCalls.length, 2);
  });
});

describe('puppeteerPdfRenderer shutdown', () => {
  const CHROME = '/usr/bin/chromium';

  it('is a no-op when no browser was launched', async () => {
    const ctx = setup({ executables: [CHROME] });
    await ctx.renderer.closeBrowser();
    assert.equal(ctx.puppeteer.launchCalls.length, 0);
  });

  it('closes the browser once and relaunches on the next render', async () => {
    const ctx = setup({ executables: [CHROME] });
    await ctx.renderer.renderHtmlToPdf('<p>1</p>');
    await ctx.renderer.closeBrowser();
    await ctx.renderer.closeBrowser();
    assert.equal(ctx.puppeteer.browsers[0].closed, 1);

    await ctx.renderer.renderHtmlToPdf('<p>2</p>');
    assert.equal(ctx.puppeteer.launchCalls.length, 2);
  });

  it('does not throw when closing after a failed launch', async () => {
    const ctx = setup({ executables: [CHROME], puppeteer: createFakePuppeteer({ launchError: new Error('boom') }) });
    await assert.rejects(ctx.renderer.renderHtmlToPdf('<p>x</p>'));
    await ctx.renderer.closeBrowser();
  });

  it('closes a browser whose launch is still in flight', async () => {
    const ctx = setup({ executables: [CHROME] });
    const render = ctx.renderer.renderHtmlToPdf('<p>x</p>');
    await ctx.renderer.closeBrowser();
    await render;
    assert.equal(ctx.puppeteer.browsers[0].closed, 1);
  });
});

describe('puppeteerPdfRenderer async hygiene', () => {
  it('left no unhandled promise rejections behind', async () => {
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  });
});
