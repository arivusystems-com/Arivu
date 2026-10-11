'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../../utils/contentPlatformErrors');

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'];

const SYSTEM_CHROME_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ],
  linux: [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ]
};

function isModuleNotFound(error, specifier) {
  return (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND')
    && String(error.message || '').includes(specifier);
}

/** puppeteer-core >= 25 is ESM-only; dynamic import works from CommonJS on every supported Node. */
async function defaultLoadPuppeteer() {
  for (const specifier of ['puppeteer-core', 'puppeteer']) {
    try {
      const mod = await import(specifier);
      return mod.default || mod;
    } catch (error) {
      if (!isModuleNotFound(error, specifier)) {
        throw new ContentPlatformError(
          CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED,
          `Failed to load PDF rendering dependency "${specifier}": ${error.message}`,
          { statusCode: 503, cause: error }
        );
      }
    }
  }
  throw new ContentPlatformError(
    CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED,
    'PDF rendering dependency missing. Run `npm ci` in the server directory.',
    { statusCode: 503 }
  );
}

async function defaultIsExecutable(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return false;
    await fs.promises.access(filePath, fs.constants.X_OK);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

/**
 * @param {object} [deps]
 * @param {() => Promise<object>} [deps.loadPuppeteer]
 * @param {(filePath: string) => Promise<boolean>} [deps.isExecutable]
 * @param {NodeJS.ProcessEnv} [deps.env]
 * @param {NodeJS.Platform} [deps.platform]
 * @param {{ warn: Function }} [deps.logger]
 */
function createPuppeteerPdfRenderer({
  loadPuppeteer = defaultLoadPuppeteer,
  isExecutable = defaultIsExecutable,
  env = process.env,
  platform = process.platform,
  logger = console
} = {}) {
  let browserPromise = null;

  /**
   * @returns {Promise<{ executablePath: string | null, source: string | null, lookupError: Error | null, missingConfigured: string[] }>}
   */
  async function resolveChromeExecutable() {
    const missingConfigured = [];
    for (const name of ['PUPPETEER_EXECUTABLE_PATH', 'CHROME_PATH']) {
      const configured = String(env[name] || '').trim();
      if (!configured) continue;
      if (await isExecutable(configured)) {
        return { executablePath: configured, source: name, lookupError: null, missingConfigured };
      }
      missingConfigured.push(`${name}=${configured}`);
      logger.warn(`[puppeteerPdfRenderer] ${name} does not point to an executable file: ${configured}`);
    }

    for (const candidate of SYSTEM_CHROME_PATHS[platform] || []) {
      if (await isExecutable(candidate)) {
        return { executablePath: candidate, source: 'system', lookupError: null, missingConfigured };
      }
    }

    const puppeteer = await loadPuppeteer();
    let lookupError = null;
    if (typeof puppeteer.executablePath === 'function') {
      try {
        // Sync string in puppeteer-core <= 24, Promise<string> in >= 25.
        const bundled = await puppeteer.executablePath();
        if (typeof bundled === 'string' && bundled && await isExecutable(bundled)) {
          return { executablePath: bundled, source: 'puppeteer', lookupError: null, missingConfigured };
        }
      } catch (error) {
        lookupError = error;
      }
    }

    return { executablePath: null, source: null, lookupError, missingConfigured };
  }

  async function resolveChromeExecutablePath() {
    const { executablePath } = await resolveChromeExecutable();
    return executablePath;
  }

  function buildChromeNotFoundError({ lookupError, missingConfigured }) {
    const cacheDir = env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
    const details = [];
    if (missingConfigured.length) {
      details.push(`Configured path(s) not executable: ${missingConfigured.join(', ')}.`);
    }
    if (lookupError) {
      details.push(`Puppeteer browser lookup failed: ${lookupError.message}.`);
    }
    return new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED,
      [
        'Chrome is required for PDF rendering but was not found.',
        'Install Google Chrome/Chromium, or set PUPPETEER_EXECUTABLE_PATH / CHROME_PATH.',
        `Expected Puppeteer cache: ${cacheDir}`,
        ...details
      ].join(' '),
      { statusCode: 503, ...(lookupError ? { cause: lookupError } : {}) }
    );
  }

  async function launchBrowser() {
    const puppeteer = await loadPuppeteer();
    const resolved = await resolveChromeExecutable();
    if (!resolved.executablePath) {
      throw buildChromeNotFoundError(resolved);
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: resolved.executablePath,
        args: LAUNCH_ARGS
      });
    } catch (error) {
      throw new ContentPlatformError(
        CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED,
        `Failed to launch Chrome for PDF rendering: ${error.message}`,
        { statusCode: 503, cause: error }
      );
    }
    return browser;
  }

  function getBrowser() {
    if (!browserPromise) {
      const pending = launchBrowser().then((browser) => {
        if (typeof browser.once === 'function') {
          browser.once('disconnected', () => {
            if (browserPromise === pending) browserPromise = null;
          });
        }
        return browser;
      });
      pending.catch(() => {
        if (browserPromise === pending) browserPromise = null;
      });
      browserPromise = pending;
    }
    return browserPromise;
  }

  /**
   * @param {string} html
   * @param {object} [options]
   */
  async function renderHtmlToPdf(html, options = {}) {
    const browser = await getBrowser();
    let page = null;

    try {
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfOptions = {
        printBackground: true,
        preferCSSPageSize: true
      };

      if (options.paperSize && options.paperSize !== 'Custom') {
        pdfOptions.format = options.paperSize;
      } else if (options.paperSize === 'Custom' && options.dimensions) {
        pdfOptions.width = `${options.dimensions.width}mm`;
        pdfOptions.height = `${options.dimensions.height}mm`;
      }

      if (options.orientation === 'landscape') {
        pdfOptions.landscape = true;
      }

      return Buffer.from(await page.pdf(pdfOptions));
    } catch (error) {
      throw new ContentPlatformError(
        CONTENT_PLATFORM_ERROR_CODES.RENDER_NOT_IMPLEMENTED,
        `PDF rendering failed: ${error.message}`,
        { statusCode: 503, cause: error }
      );
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          logger.warn(`[puppeteerPdfRenderer] Failed to close page: ${closeError.message}`);
        }
      }
    }
  }

  async function closeBrowser() {
    if (!browserPromise) return;
    const pending = browserPromise;
    browserPromise = null;
    let browser;
    try {
      browser = await pending;
    } catch {
      return;
    }
    await browser.close();
  }

  return {
    renderHtmlToPdf,
    closeBrowser,
    resolveChromeExecutablePath
  };
}

const defaultRenderer = createPuppeteerPdfRenderer();

module.exports = {
  renderHtmlToPdf: defaultRenderer.renderHtmlToPdf,
  closeBrowser: defaultRenderer.closeBrowser,
  resolveChromeExecutablePath: defaultRenderer.resolveChromeExecutablePath,
  createPuppeteerPdfRenderer,
  SYSTEM_CHROME_PATHS
};
