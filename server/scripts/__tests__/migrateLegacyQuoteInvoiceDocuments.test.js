'use strict';

const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveLegacyDocumentDiskPath,
  assertStorageConfigured,
} = require('../migrateLegacyQuoteInvoiceDocuments');

describe('legacy quote and invoice document paths', () => {
  const publicDir = path.resolve('/srv/arivu/server/public');

  it('maps API static URLs onto server/public', () => {
    const quote = resolveLegacyDocumentDiskPath(
      '/api/quote-documents/org/quote/file.pdf',
      publicDir
    );
    assert.equal(quote.category, 'quotes');
    assert.equal(
      quote.absolutePath,
      path.resolve(publicDir, 'quote-documents/org/quote/file.pdf')
    );

    const invoice = resolveLegacyDocumentDiskPath(
      '/api/invoice-documents/org/invoice/file.pdf',
      publicDir
    );
    assert.equal(invoice.category, 'invoices');
    assert.equal(
      invoice.absolutePath,
      path.resolve(publicDir, 'invoice-documents/org/invoice/file.pdf')
    );
  });

  it('rejects object-storage URLs and path traversal', () => {
    assert.equal(resolveLegacyDocumentDiskPath('/api/files/download?storagePath=oci%3Auploads', publicDir), null);
    assert.equal(resolveLegacyDocumentDiskPath('/api/quote-documents/../../etc/passwd', publicDir), null);
  });

  it('refuses to apply without storage configuration', () => {
    const names = [
      'STORAGE_ENDPOINT',
      'STORAGE_REGION',
      'STORAGE_ACCESS_KEY',
      'STORAGE_SECRET_KEY',
      'STORAGE_BUCKET',
    ];
    const saved = {};
    for (const name of names) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
    try {
      assert.throws(() => assertStorageConfigured(), /STORAGE_BUCKET/);
    } finally {
      for (const name of names) {
        if (saved[name] == null) delete process.env[name];
        else process.env[name] = saved[name];
      }
    }
  });
});
