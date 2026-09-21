const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveFiscalYearStartMonth,
  applyFiscalYearStartMonth,
  getFiscalQuarterRange,
  currentFiscalQuarter,
  currentFiscalYear,
} = require('../fiscalYear');

describe('fiscalYear', () => {
  it('prefers settings.fiscalYearStartMonth over analytics', () => {
    assert.equal(
      resolveFiscalYearStartMonth({
        settings: { fiscalYearStartMonth: 7, analytics: { fiscalYearStartMonth: 4 } },
      }),
      7
    );
    assert.equal(
      resolveFiscalYearStartMonth({
        settings: { analytics: { fiscalYearStartMonth: 4 } },
      }),
      4
    );
    assert.equal(resolveFiscalYearStartMonth({}), 1);
  });

  it('dual-writes FY start month', () => {
    const org = { settings: {} };
    applyFiscalYearStartMonth(org, 4);
    assert.equal(org.settings.fiscalYearStartMonth, 4);
    assert.equal(org.settings.analytics.fiscalYearStartMonth, 4);
  });

  it('computes April FY quarters', () => {
    const q1 = getFiscalQuarterRange(2025, 1, 4);
    assert.equal(q1.start.getFullYear(), 2025);
    assert.equal(q1.start.getMonth(), 3);
    assert.equal(q1.end.getMonth(), 5);

    const q4 = getFiscalQuarterRange(2025, 4, 4);
    assert.equal(q4.start.getFullYear(), 2026);
    assert.equal(q4.start.getMonth(), 0);
    assert.equal(q4.end.getMonth(), 2);
  });

  it('resolves current fiscal quarter and year', () => {
    assert.equal(currentFiscalQuarter(new Date(2025, 8, 15), 4), 2);
    assert.equal(currentFiscalYear(new Date(2025, 2, 15), 4), 2024);
    assert.equal(currentFiscalQuarter(new Date(2025, 0, 15), 1), 1);
  });
});
