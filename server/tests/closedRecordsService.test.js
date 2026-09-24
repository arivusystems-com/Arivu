/**
 * Closed Records — unit tests (validation + sync evaluation, no DB).
 */

const {
  validateConfigPayload,
  isLifecycleClosedSync,
  getReopenStatusForValue,
  buildLifecycleQueries,
  closedValueSet
} = require('../services/closedRecordsService');
const { getModuleDef } = require('../constants/closedRecordsModules');

describe('closedRecordsService validation', () => {
  const def = getModuleDef('cases');
  const picklist = [
    'New',
    'Assigned',
    'In Progress',
    'On Hold',
    'Waiting for Customer',
    'Resolved',
    'Closed'
  ];

  test('requires at least one closed state when enabled', () => {
    const result = validateConfigPayload(def, { enabled: true, closedStates: [], reopenEnabled: true }, picklist);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CLOSED_STATE_REQUIRED');
  });

  test('requires reopen status when reopen enabled', () => {
    const result = validateConfigPayload(
      def,
      {
        enabled: true,
        reopenEnabled: true,
        closedStates: [{ statusValue: 'Closed', reopenStatusValue: null }]
      },
      picklist
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('REOPEN_STATUS_REQUIRED');
  });

  test('rejects reopen status that is also closed', () => {
    const result = validateConfigPayload(
      def,
      {
        enabled: true,
        reopenEnabled: true,
        closedStates: [
          { statusValue: 'Closed', reopenStatusValue: 'Resolved' },
          { statusValue: 'Resolved', reopenStatusValue: 'In Progress' }
        ]
      },
      picklist
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('REOPEN_CANNOT_BE_CLOSED');
  });

  test('accepts valid closed + reopen mapping', () => {
    const result = validateConfigPayload(
      def,
      {
        enabled: true,
        reopenEnabled: true,
        allowLinkingToClosed: true,
        closedStates: [
          { statusValue: 'Resolved', reopenStatusValue: 'In Progress' },
          { statusValue: 'Closed', reopenStatusValue: 'In Progress' }
        ]
      },
      picklist
    );
    expect(result.ok).toBe(true);
    expect(result.value.closedStates).toHaveLength(2);
  });

  test('rejects closed state not in picklist', () => {
    const result = validateConfigPayload(
      def,
      {
        enabled: true,
        reopenEnabled: false,
        closedStates: [{ statusValue: 'NotAStatus' }]
      },
      picklist
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_CLOSED_STATE');
  });
});

describe('closedRecordsService evaluation', () => {
  const config = {
    enabled: true,
    statusField: 'status',
    reopenEnabled: true,
    closedStates: [
      { statusValue: 'Closed', reopenStatusValue: 'In Progress' },
      { statusValue: 'Resolved', reopenStatusValue: 'In Progress' }
    ]
  };

  test('isLifecycleClosedSync matches closed status', () => {
    expect(isLifecycleClosedSync(config, { status: 'Closed' })).toBe(true);
    expect(isLifecycleClosedSync(config, { status: 'New' })).toBe(false);
    expect(isLifecycleClosedSync(config, { lifecycleState: 'closed', status: 'New' })).toBe(true);
  });

  test('getReopenStatusForValue returns mapping', () => {
    expect(getReopenStatusForValue(config, 'Closed')).toBe('In Progress');
    expect(getReopenStatusForValue(config, 'New')).toBe(null);
  });

  test('buildLifecycleQueries produces open/closed fragments', () => {
    const q = buildLifecycleQueries(config);
    expect(closedValueSet(config).has('Closed')).toBe(true);
    expect(q.closedQuery.$or).toBeDefined();
    expect(q.openQuery.$and).toBeDefined();
  });
});

describe('closedRecordsModules deals defaults', () => {
  test('buildDefaults picks won/lost stages', () => {
    const def = getModuleDef('deals');
    const values = ['New', 'Negotiation', 'Closed Won', 'Closed Lost'];
    const defaults = def.buildDefaults(values);
    expect(defaults.some((d) => d.statusValue === 'Closed Won')).toBe(true);
    expect(defaults.some((d) => d.statusValue === 'Closed Lost')).toBe(true);
    expect(defaults.every((d) => d.reopenStatusValue === 'Negotiation')).toBe(true);
  });
});
