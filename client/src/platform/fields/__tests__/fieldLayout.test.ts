import { describe, it, expect } from 'vitest';
import {
  applyFieldLayoutToModuleState,
  moveFieldAcrossLayout,
  moveFieldToSection,
  createCustomSection,
  deleteSectionIfEmpty,
  groupFieldsByLayout
} from '@/platform/fields/fieldLayout';

describe('fieldLayout', () => {
  it('seeds people core fields into Basic Information', () => {
    const { layout, fields } = applyFieldLayoutToModuleState('people', [
      { key: 'first_name', order: 0 },
      { key: 'email', order: 1 },
      { key: 'assignedTo', order: 2 },
      { key: 'lead_status', order: 3 },
      { key: 'createdAt', order: 4 }
    ], null);

    expect(layout.sections.map((s) => s.id)).toEqual(['basic', 'additional']);
    expect(fields.find((f) => f.key === 'first_name')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'email')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'assignedTo')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'lead_status')?.sectionId).toBe('additional');
    expect(fields.find((f) => f.key === 'createdAt')?.sectionId).toBe('additional');
  });

  it('collapses legacy people contact/assignment sections into basic', () => {
    const { layout, fields } = applyFieldLayoutToModuleState(
      'people',
      [
        { key: 'first_name', sectionId: 'basic', order: 0 },
        { key: 'email', sectionId: 'contact', order: 1 },
        { key: 'assignedTo', sectionId: 'assignment', order: 2 },
        { key: 'createdAt', sectionId: 'additional', order: 3 }
      ],
      {
        version: 1,
        sections: [
          { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
          { id: 'contact', labelKey: 'settings.modFieldsSectionContact', order: 1, protected: true },
          { id: 'assignment', labelKey: 'settings.modFieldsSectionAssignment', order: 2, protected: true },
          { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 3, protected: true }
        ]
      }
    );

    expect(layout.sections.map((s) => s.id)).toEqual(['basic', 'additional']);
    expect(fields.find((f) => f.key === 'email')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'assignedTo')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'createdAt')?.sectionId).toBe('additional');
  });

  it('repairs people Basic Information seed order once', () => {
    const { layout, fields } = applyFieldLayoutToModuleState(
      'people',
      [
        { key: 'assignedTo', sectionId: 'basic', order: 0 },
        { key: 'source', sectionId: 'basic', order: 1 },
        { key: 'first_name', sectionId: 'basic', order: 2 },
        { key: 'last_name', sectionId: 'basic', order: 3 },
        { key: 'email', sectionId: 'basic', order: 4 },
        { key: 'phone', sectionId: 'basic', order: 5 },
        { key: 'mobile', sectionId: 'basic', order: 6 },
        { key: 'organization', sectionId: 'basic', order: 7 },
        { key: 'tags', sectionId: 'basic', order: 8 },
        { key: 'do_not_contact', sectionId: 'basic', order: 9 },
        { key: 'createdAt', sectionId: 'additional', order: 10 }
      ],
      {
        version: 1,
        sections: [
          { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
          { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
        ]
      }
    );

    expect(layout.peopleBasicSeedOrder).toBe(1);
    expect(
      fields.filter((f) => f.sectionId === 'basic').map((f) => f.key)
    ).toEqual([
      'first_name',
      'last_name',
      'email',
      'phone',
      'mobile',
      'organization',
      'assignedTo',
      'tags',
      'do_not_contact',
      'source'
    ]);

    const preserved = applyFieldLayoutToModuleState(
      'people',
      [
        { key: 'assignedTo', sectionId: 'basic', order: 0 },
        { key: 'first_name', sectionId: 'basic', order: 1 },
        { key: 'createdAt', sectionId: 'additional', order: 2 }
      ],
      layout
    );
    expect(preserved.fields.filter((f) => f.sectionId === 'basic').map((f) => f.key)).toEqual([
      'assignedTo',
      'first_name'
    ]);
  });

  it('collapses organizations contact into basic and pulls address/primaryContact', () => {
    const { layout, fields } = applyFieldLayoutToModuleState(
      'organizations',
      [
        { key: 'name', sectionId: 'basic', order: 0 },
        { key: 'industry', sectionId: 'basic', order: 1 },
        { key: 'website', sectionId: 'basic', order: 2 },
        { key: 'phone', sectionId: 'contact', order: 3 },
        { key: 'assignedTo', sectionId: 'contact', order: 4 },
        { key: 'address', sectionId: 'additional', order: 5 },
        { key: 'primaryContact', sectionId: 'additional', order: 6 },
        { key: 'tags', sectionId: 'additional', order: 7 },
        { key: 'createdAt', sectionId: 'additional', order: 8 }
      ],
      {
        version: 1,
        sections: [
          { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
          { id: 'contact', labelKey: 'settings.modFieldsSectionContact', order: 1, protected: true },
          { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 2, protected: true }
        ]
      }
    );

    expect(layout.sections.map((s) => s.id)).toEqual(['basic', 'additional']);
    expect(layout.orgBasicSeedOrder).toBe(2);
    expect(fields.find((f) => f.key === 'phone')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'assignedTo')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'address')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'primaryContact')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'tags')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'createdAt')?.sectionId).toBe('additional');
    expect(
      fields.filter((f) => f.sectionId === 'basic').map((f) => f.key)
    ).toEqual([
      'name',
      'industry',
      'website',
      'phone',
      'assignedTo',
      'address',
      'primaryContact',
      'tags'
    ]);
  });

  it('collapses tasks scheduling into basic and pulls core fields', () => {
    const { layout, fields } = applyFieldLayoutToModuleState(
      'tasks',
      [
        { key: 'title', sectionId: 'general', order: 0, owner: 'core' },
        { key: 'status', sectionId: 'general', order: 1, owner: 'core' },
        { key: 'startDate', sectionId: 'scheduling', order: 2, owner: 'core' },
        { key: 'dueDate', sectionId: 'scheduling', order: 3, owner: 'core' },
        { key: 'estimatedHours', sectionId: 'additional', order: 4, owner: 'core' },
        { key: 'taskType', sectionId: 'additional', order: 5, owner: 'core' },
        { key: 'description', sectionId: 'additional', order: 6, owner: 'core' },
        { key: 'createdAt', sectionId: 'additional', order: 7, owner: 'system' }
      ],
      {
        version: 1,
        sections: [
          { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
          { id: 'scheduling', labelKey: 'settings.modFieldsSectionScheduling', order: 1, protected: true },
          { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 2, protected: true }
        ]
      }
    );

    expect(layout.sections.map((s) => s.id)).toEqual(['basic', 'additional']);
    expect(layout.taskBasicSeedOrder).toBe(2);
    expect(fields.find((f) => f.key === 'title')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'startDate')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'dueDate')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'estimatedHours')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'taskType')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'description')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'createdAt')?.sectionId).toBe('additional');
  });

  it('allows moving core fields across layout sections', () => {
    const { layout, fields } = applyFieldLayoutToModuleState('people', [
      { key: 'first_name', order: 0 },
      { key: 'email', order: 1 }
    ], null);

    const moved = moveFieldToSection(fields, layout, 'first_name', 'additional');
    expect(moved.find((f) => f.key === 'first_name')?.sectionId).toBe('additional');

    const across = moveFieldAcrossLayout(moved, layout, 'first_name', 'email');
    expect(across.find((f) => f.key === 'first_name')?.sectionId).toBe(
      across.find((f) => f.key === 'email')?.sectionId
    );
  });

  it('protects standard sections from delete and allows empty custom delete', () => {
    const { layout, fields } = applyFieldLayoutToModuleState('people', [
      { key: 'first_name', order: 0 }
    ], null);
    const withCustom = createCustomSection(layout, 'My Block');
    const customId = withCustom.sections.find((s) => !s.protected)!.id;

    expect(deleteSectionIfEmpty(withCustom, fields, 'basic')).toEqual({
      ok: false,
      reason: 'protected'
    });
    expect(deleteSectionIfEmpty(withCustom, fields, customId).ok).toBe(true);
  });

  it('groups by layout section ids', () => {
    const { layout, fields } = applyFieldLayoutToModuleState('people', [
      { key: 'first_name', order: 0 },
      { key: 'email', order: 1 }
    ], null);
    const groups = groupFieldsByLayout(fields, layout);
    expect(groups.find((g) => g.section.id === 'basic')?.fieldKeys).toContain('first_name');
    expect(groups.find((g) => g.section.id === 'basic')?.fieldKeys).toContain('email');
  });

  it('seeds quote core fields into Basic Information and repairs collapsed additional dump', () => {
    const { layout, fields } = applyFieldLayoutToModuleState(
      'quotes',
      [
        { key: 'quoteTitle', sectionId: 'additional', order: 0 },
        { key: 'quoteDate', sectionId: 'additional', order: 1 },
        { key: 'status', sectionId: 'additional', order: 2 },
        { key: 'createdAt', sectionId: 'additional', order: 3 },
        { key: 'quoteNumber', sectionId: 'additional', order: 4 }
      ],
      {
        version: 1,
        sections: [
          { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
          { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
        ]
      }
    );

    expect(layout.sections.map((s) => s.id)).toEqual(['basic', 'additional']);
    expect(layout.sections[0]?.labelKey).toBe('settings.modFieldsSectionBasic');
    expect(fields.find((f) => f.key === 'quoteTitle')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'quoteDate')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'status')?.sectionId).toBe('basic');
    expect(fields.find((f) => f.key === 'createdAt')?.sectionId).toBe('additional');
    expect(fields.find((f) => f.key === 'quoteNumber')?.sectionId).toBe('additional');
  });
});
