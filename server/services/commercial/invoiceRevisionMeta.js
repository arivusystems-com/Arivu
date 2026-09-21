'use strict';

/**
 * Invoice revision versioning (in-place revise audit).
 * Original = v1; each snapshot.revisions entry advances current version by 1.
 * Historical version k (1..N-1) = revisions[k - 1].before
 */

function getInvoiceRevisionList(invoice) {
  const raw = invoice?.snapshot?.revisions;
  return Array.isArray(raw) ? raw : [];
}

function getInvoiceRevisionMeta(invoice) {
  const revisionCount = getInvoiceRevisionList(invoice).length;
  return {
    revisionCount,
    currentVersion: revisionCount + 1,
    isRevised: revisionCount > 0,
  };
}

/**
 * Snapshot used to display/restore a version.
 * @returns {object|null} before-shaped totals+lines, or null for current (caller uses live invoice)
 */
function getInvoiceVersionSnapshot(invoice, version) {
  const revisions = getInvoiceRevisionList(invoice);
  const currentVersion = revisions.length + 1;
  const v = Math.round(Number(version) || 0);
  if (v < 1 || v > currentVersion) return null;
  if (v === currentVersion) return null;
  const entry = revisions[v - 1];
  return entry?.before || null;
}

module.exports = {
  getInvoiceRevisionList,
  getInvoiceRevisionMeta,
  getInvoiceVersionSnapshot,
};
