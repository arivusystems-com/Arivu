import { describe, it, expect } from 'vitest';
import { buildCreateSurfaceBlocks, getModuleCompositeAnchors } from '@/platform/fields/createSurface';

const t = (key: string) => key;

describe('createSurface', () => {
  it('orders people field sections with app participation after basic (legacy contact/assignment collapsed)', () => {
    const blocks = buildCreateSurfaceBlocks({
      moduleKey: 'people',
      fields: [
        { key: 'first_name', sectionId: 'basic', order: 0, owner: 'core' },
        { key: 'email', sectionId: 'contact', order: 1, owner: 'core' },
        { key: 'assignedTo', sectionId: 'assignment', order: 2, owner: 'core' },
        { key: 'tags', sectionId: 'additional', order: 3, owner: 'core' },
        { key: 'lead_status', sectionId: 'additional', order: 4, owner: 'participation' }
      ],
      fieldLayout: null,
      t,
      includeComposites: ['app_participation'],
      excludeParticipationOwner: true
    });

    expect(blocks.map((b) => (b.type === 'fields' ? b.sectionId : b.id))).toEqual([
      'basic',
      'app_participation',
      'additional'
    ]);
    const basic = blocks.find((b) => b.type === 'fields' && b.sectionId === 'basic');
    expect(basic && basic.type === 'fields' && basic.fields.map((f) => f.key)).toEqual(
      expect.arrayContaining(['first_name', 'email', 'assignedTo'])
    );
    const additional = blocks.find((b) => b.type === 'fields' && b.sectionId === 'additional');
    expect(additional && additional.type === 'fields' && additional.fields.map((f) => f.key)).toEqual([
      'tags'
    ]);
  });

  it('inserts commercial lines after general', () => {
    const blocks = buildCreateSurfaceBlocks({
      moduleKey: 'quotes',
      fields: [
        { key: 'quoteNumber', sectionId: 'basic', order: 0 },
        { key: 'notes', sectionId: 'additional', order: 1 }
      ],
      fieldLayout: null,
      t,
      includeComposites: ['lines']
    });

    expect(blocks.map((b) => (b.type === 'fields' ? b.sectionId : b.id))).toEqual([
      'basic',
      'lines',
      'additional'
    ]);
  });

  it('clusters deal relationship then lines after pipeline', () => {
    const blocks = buildCreateSurfaceBlocks({
      moduleKey: 'deals',
      fields: [
        { key: 'name', sectionId: 'general', order: 0 },
        { key: 'stage', sectionId: 'pipeline', order: 1 },
        { key: 'notes', sectionId: 'additional', order: 2 }
      ],
      fieldLayout: null,
      t,
      includeComposites: ['deal_relationships', 'lines']
    });

    expect(blocks.map((b) => (b.type === 'fields' ? b.sectionId : b.id))).toEqual([
      'general',
      'pipeline',
      'deal_relationships',
      'lines',
      'additional'
    ]);
  });

  it('exposes org vendor_catalog anchor after participation', () => {
    expect(getModuleCompositeAnchors('organizations').map((a) => a.id)).toEqual([
      'app_participation',
      'vendor_catalog'
    ]);
  });

  it('clusters org participation then vendor catalog after basic', () => {
    const blocks = buildCreateSurfaceBlocks({
      moduleKey: 'organizations',
      fields: [
        { key: 'name', sectionId: 'basic', order: 0, owner: 'core' },
        { key: 'customField', sectionId: 'additional', order: 1, owner: 'core' }
      ],
      fieldLayout: null,
      t,
      includeComposites: ['app_participation', 'vendor_catalog']
    });

    expect(blocks.map((b) => (b.type === 'fields' ? b.sectionId : b.id))).toEqual([
      'basic',
      'app_participation',
      'vendor_catalog',
      'additional'
    ]);
  });
});
