/**
 * Invoice revision versioning helpers (mirrors server invoiceRevisionMeta).
 * Original = v1; each snapshot.revisions entry advances current version by 1.
 */

export function getInvoiceRevisionList(invoice) {
  const raw = invoice?.snapshot?.revisions;
  return Array.isArray(raw) ? raw : [];
}

export function getInvoiceRevisionMeta(invoice) {
  const revisionCount = getInvoiceRevisionList(invoice).length;
  const fromApi = Number(invoice?.currentVersion);
  const currentVersion = Number.isFinite(fromApi) && fromApi > 0
    ? fromApi
    : revisionCount + 1;
  const isRevised = invoice?.isRevised === true || revisionCount > 0;
  return {
    revisionCount: Number(invoice?.revisionCount) || revisionCount,
    currentVersion,
    isRevised,
  };
}

/** Historical version snapshot (null = use live invoice for current). */
export function getInvoiceVersionSnapshot(invoice, version) {
  const revisions = getInvoiceRevisionList(invoice);
  const { currentVersion } = getInvoiceRevisionMeta(invoice);
  const v = Math.round(Number(version) || 0);
  if (v < 1 || v > currentVersion) return null;
  if (v === currentVersion) return null;
  return revisions[v - 1]?.before || null;
}

export function buildInvoiceVersionOptions(invoice) {
  const { currentVersion, isRevised } = getInvoiceRevisionMeta(invoice);
  if (!isRevised) {
    return [{ value: currentVersion, label: `v${currentVersion}`, isCurrent: true }];
  }
  const options = [];
  for (let v = currentVersion; v >= 1; v -= 1) {
    options.push({
      value: v,
      label: v === currentVersion ? `v${v} (current)` : `v${v}`,
      isCurrent: v === currentVersion,
    });
  }
  return options;
}
