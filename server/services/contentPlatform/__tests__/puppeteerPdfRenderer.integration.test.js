'use strict';

/**
 * Real-browser smoke test. Skips when no Chrome/Chromium is resolvable
 * (set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH to force a specific binary).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createPuppeteerPdfRenderer } = require('../renderers/puppeteerPdfRenderer');

describe('puppeteerPdfRenderer (real browser)', () => {
  const renderer = createPuppeteerPdfRenderer();
  let executablePath = null;

  before(async () => {
    executablePath = await renderer.resolveChromeExecutablePath();
  });

  after(() => renderer.closeBrowser());

  it('renders a PDF with an installed Chrome/Chromium', async (t) => {
    if (!executablePath) {
      t.skip('No Chrome/Chromium executable found (set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH)');
      return;
    }
    const buffer = await renderer.renderHtmlToPdf('<h1>Arivu</h1>', { paperSize: 'A4' });
    assert.equal(buffer.subarray(0, 5).toString('latin1'), '%PDF-');
  });
});
