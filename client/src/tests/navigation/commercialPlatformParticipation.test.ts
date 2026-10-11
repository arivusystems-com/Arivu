import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_PLATFORM_MODULE_KEYS,
  hasCommercialPlatformEntitlement,
  isCommercialPlatformModuleKey
} from '@/utils/commercialPlatformParticipation';

describe('commercialPlatformParticipation', () => {
  it('identifies commercial platform module keys', () => {
    expect(isCommercialPlatformModuleKey('quotes')).toBe(true);
    expect(isCommercialPlatformModuleKey('payments')).toBe(true);
    expect(isCommercialPlatformModuleKey('deals')).toBe(false);
  });

  it('grants commercial visibility when Sales is entitled', () => {
    const allowed = new Set(['SALES']);
    expect(
      hasCommercialPlatformEntitlement(allowed, true, () => false)
    ).toBe(true);
  });

  it('denies commercial visibility when only Inventory is entitled', () => {
    const allowed = new Set(['INVENTORY']);
    expect(
      hasCommercialPlatformEntitlement(allowed, true, () => false)
    ).toBe(false);
  });

  it('denies commercial visibility without participating apps', () => {
    const allowed = new Set(['AUDIT']);
    expect(
      hasCommercialPlatformEntitlement(allowed, true, () => false)
    ).toBe(false);
  });

  it('includes all quote-to-cash modules in the set', () => {
    expect([...COMMERCIAL_PLATFORM_MODULE_KEYS].sort()).toEqual(
      ['invoices', 'payments', 'quotes', 'sales_orders'].sort()
    );
  });
});
