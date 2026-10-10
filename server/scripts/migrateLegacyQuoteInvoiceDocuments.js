#!/usr/bin/env node
'use strict';

/**
 * Copy legacy quote/invoice PDFs from this machine's server/public tree into Object Storage.
 *
 * Existing rows store filePath as:
 *   /api/quote-documents/{organizationId}/{quoteId}/{file}
 *   /api/invoice-documents/{organizationId}/{invoiceId}/{file}
 * with storageProvider "local" (the schema default). Those URLs are served by
 * express.static(server/public) mounted at /api, so the bytes live only on the
 * disk of the API that generated them.
 *
 * This script does not run at startup and does not delete local files.
 * Default is a dry run. Pass --apply to upload and update rows.
 *
 *   node server/scripts/migrateLegacyQuoteInvoiceDocuments.js
 *   node server/scripts/migrateLegacyQuoteInvoiceDocuments.js --apply
 *   node server/scripts/migrateLegacyQuoteInvoiceDocuments.js --apply --org-id=<id>
 *
 * --apply requires STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_ACCESS_KEY,
 * STORAGE_SECRET_KEY, and STORAGE_BUCKET. The script does not guess a bucket.
 * Run it on a machine that still has the files under server/public.
 */

const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.resolve(__dirname, '../public');

const LEGACY_KINDS = Object.freeze([
  { model: 'QuoteDocument', prefix: '/api/quote-documents/', category: 'quotes' },
  { model: 'InvoiceDocument', prefix: '/api/invoice-documents/', category: 'invoices' },
]);

function resolveLegacyDocumentDiskPath(filePath, publicDir = PUBLIC_DIR) {
  const raw = String(filePath || '');
  const kind = LEGACY_KINDS.find((entry) => raw.startsWith(entry.prefix));
  if (!kind) return null;
  const relative = raw.slice('/api/'.length);
  if (!relative || relative.split('/').includes('..') || relative.includes('\\')) return null;
  const root = path.resolve(publicDir);
  const absolutePath = path.resolve(root, relative);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) return null;
  return {
    absolutePath,
    category: kind.category,
    fileName: path.basename(absolutePath),
  };
}

function parseArgs(argv) {
  const args = { apply: false, orgId: null };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg.startsWith('--org-id=')) args.orgId = arg.slice('--org-id='.length).trim();
  }
  return args;
}

function assertStorageConfigured() {
  const required = [
    'STORAGE_ENDPOINT',
    'STORAGE_REGION',
    'STORAGE_ACCESS_KEY',
    'STORAGE_SECRET_KEY',
    'STORAGE_BUCKET',
  ];
  const missing = required.filter((name) => !String(process.env[name] || '').trim());
  if (missing.length) {
    const err = new Error(
      `Object storage is not configured (${missing.join(', ')}). Refusing to guess a bucket.`
    );
    err.code = 'STORAGE_CONFIG_MISSING';
    throw err;
  }
}

async function migrateDocuments(Model, kind, { apply, fileStorage }) {
  const docs = await Model.find({
    storageProvider: { $ne: 'oci' },
    filePath: new RegExp(`^${kind.prefix.replace(/\//g, '\\/')}`),
  })
    .select('_id organizationId filePath storageProvider')
    .lean();

  const stats = { seen: docs.length, uploaded: 0, wouldUpload: 0, missing: 0, skipped: 0 };
  for (const doc of docs) {
    const located = resolveLegacyDocumentDiskPath(doc.filePath);
    if (!located) {
      stats.skipped += 1;
      continue;
    }
    if (!fs.existsSync(located.absolutePath)) {
      stats.missing += 1;
      console.log(`   MISSING ${doc._id} ${located.absolutePath}`);
      continue;
    }
    if (!apply) {
      stats.wouldUpload += 1;
      console.log(`   WOULD UPLOAD ${doc._id} ${located.absolutePath}`);
      continue;
    }
    const buffer = await fs.promises.readFile(located.absolutePath);
    const uploaded = await fileStorage.uploadBuffer({
      buffer,
      originalName: located.fileName,
      mimeType: 'application/pdf',
      organizationId: doc.organizationId,
      category: located.category,
    });
    await Model.updateOne(
      { _id: doc._id },
      {
        $set: {
          storageProvider: 'oci',
          filePath: uploaded.url,
          fileSizeBytes: buffer.length,
        },
      }
    );
    stats.uploaded += 1;
    console.log(`   UPLOADED ${doc._id} (local file kept)`);
  }
  return stats;
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const mongoose = require('mongoose');
  const Organization = require('../models/Organization');
  const dbConnectionManager = require('../utils/databaseConnectionManager');
  const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
  const { getMongoUris } = require('../lib/mongoConnect');
  const QuoteDocument = require('../models/QuoteDocument');
  const InvoiceDocument = require('../models/InvoiceDocument');

  const args = parseArgs(process.argv.slice(2));
  if (args.apply) assertStorageConfigured();
  const fileStorage = args.apply ? require('../services/fileStorageService') : null;

  const { masterUri, masterDbName } = getMongoUris();
  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();
  console.log(`Connected to ${masterDbName}`);
  console.log(args.apply ? 'Mode: APPLY (local files are not deleted)' : 'Mode: DRY RUN');

  const orgQuery = {};
  if (args.orgId) orgQuery._id = args.orgId;
  const organizations = await Organization.find(orgQuery).select('_id name').lean();
  const totals = { uploaded: 0, wouldUpload: 0, missing: 0, skipped: 0 };

  for (const org of organizations) {
    const orgStats = await runWithOrganizationTenantContext(org._id, async () => {
      const quoteStats = await migrateDocuments(QuoteDocument, LEGACY_KINDS[0], {
        apply: args.apply,
        fileStorage,
      });
      const invoiceStats = await migrateDocuments(InvoiceDocument, LEGACY_KINDS[1], {
        apply: args.apply,
        fileStorage,
      });
      return { quoteStats, invoiceStats };
    });
    const parts = [orgStats.quoteStats, orgStats.invoiceStats];
    const interesting = parts.some((part) => part.seen > 0);
    if (!interesting) continue;
    console.log(`Organization ${org.name || org._id}`);
    for (const part of parts) {
      totals.uploaded += part.uploaded;
      totals.wouldUpload += part.wouldUpload;
      totals.missing += part.missing;
      totals.skipped += part.skipped;
    }
  }

  console.log(
    `Done. uploaded=${totals.uploaded} wouldUpload=${totals.wouldUpload} missing=${totals.missing} skipped=${totals.skipped}`
  );
  if (totals.missing) {
    console.log('Missing files exist only on the API disk that generated them. Re-run there. No files were deleted.');
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    const mongoose = require('mongoose');
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = {
  LEGACY_KINDS,
  resolveLegacyDocumentDiskPath,
  assertStorageConfigured,
};
