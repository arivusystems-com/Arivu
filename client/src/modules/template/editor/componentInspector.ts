import type { Component } from 'grapesjs';
import { isLineItemComponent } from './lineItemModel';
import { isLayoutGridCell, isLayoutGridRow } from './printArea';
import { isImageComponent, isMergeFieldComponent, isTextComponent } from './selection';
import { isTableCellComponent } from './tableModel';

export type InspectorKind =
  | 'line-item'
  | 'table-cell'
  | 'merge-field'
  | 'variable'
  | 'formula'
  | 'conditional'
  | 'loop'
  | 'repeater'
  | 'related-records'
  | 'totals'
  | 'tax-summary'
  | 'address'
  | 'organization'
  | 'contact-card'
  | 'qr-code'
  | 'barcode'
  | 'signature'
  | 'logo'
  | 'icon'
  | 'image'
  | 'link'
  | 'button'
  | 'heading'
  | 'paragraph'
  | 'rich-text'
  | 'list'
  | 'html'
  | 'section'
  | 'container'
  | 'row'
  | 'column'
  | 'spacer'
  | 'divider'
  | 'header'
  | 'footer'
  | 'watermark'
  | 'page-break'
  | 'page-number'
  | 'social-icons'
  | 'layout-grid-row'
  | 'layout-grid-cell'
  | 'generic';

export interface InspectorContext {
  kind: InspectorKind;
  /** Component that owns the specialized settings (may be an ancestor). */
  target: Component;
  /** Component selected on canvas. */
  selected: Component;
}

const ATTR_KIND_MAP: Record<string, InspectorKind> = {
  'data-line-item': 'line-item',
  'data-merge-field': 'merge-field',
  'data-variable': 'variable',
  'data-formula': 'formula',
  'data-conditional': 'conditional',
  'data-loop': 'loop',
  'data-repeater': 'repeater',
  'data-related-records': 'related-records',
  'data-totals': 'totals',
  'data-tax-summary': 'tax-summary',
  'data-address-block': 'address',
  'data-organization-block': 'organization',
  'data-contact-card': 'contact-card',
  'data-qr-code': 'qr-code',
  'data-barcode': 'barcode',
  'data-signature': 'signature',
  'data-logo': 'logo',
  'data-icon': 'icon',
  'data-button': 'button',
  'data-heading': 'heading',
  'data-paragraph': 'paragraph',
  'data-rich-text': 'rich-text',
  'data-list': 'list',
  'data-html-block': 'html',
  'data-section': 'section',
  'data-container': 'container',
  'data-row': 'row',
  'data-column': 'column',
  'data-spacer': 'spacer',
  'data-divider': 'divider',
  'data-header-block': 'header',
  'data-footer-block': 'footer',
  'data-watermark': 'watermark',
  'data-page-break': 'page-break',
  'data-page-number': 'page-number',
  'data-social-icons': 'social-icons',
  'data-text-block': 'paragraph'
};

function attrIsTrue(value: unknown): boolean {
  return value === true || value === 'true';
}

function resolveSpecializedKind(component: Component | null | undefined): InspectorKind | null {
  if (!component) return null;

  if (isLineItemComponent(component)) return 'line-item';
  if (isTableCellComponent(component)) return 'table-cell';
  if (isLayoutGridRow(component)) return 'layout-grid-row';
  if (isLayoutGridCell(component)) return 'layout-grid-cell';

  const attrs = component.getAttributes?.() || {};
  for (const [attr, kind] of Object.entries(ATTR_KIND_MAP)) {
    if (attrIsTrue(attrs[attr])) return kind;
  }

  if (isMergeFieldComponent(component)) return 'merge-field';

  if (isImageComponent(component)) {
    return attrIsTrue(attrs['data-logo']) ? 'logo' : null;
  }

  const tag = String(component.get('tagName') || '').toLowerCase();
  if (tag === 'a' && attrIsTrue(attrs['data-button'])) return 'button';

  return null;
}

function resolveGenericKind(component: Component | null | undefined): InspectorKind {
  if (!component) return 'generic';

  const tag = String(component.get('tagName') || '').toLowerCase();

  if (isImageComponent(component)) return 'image';
  if (tag === 'a') return 'link';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'p') return 'paragraph';
  if (tag === 'ul' || tag === 'ol') return 'list';
  if (tag === 'hr') return 'divider';
  if (isMergeFieldComponent(component)) return 'merge-field';
  if (isTextComponent(component)) return 'paragraph';

  return 'generic';
}

export function resolveInspectorContext(component: Component | null | undefined): InspectorContext | null {
  if (!component) return null;

  let current: Component | null = component;
  while (current) {
    const kind = resolveSpecializedKind(current);
    if (kind) {
      return { kind, target: current, selected: component };
    }
    current = current.parent?.() ?? null;
  }

  return {
    kind: resolveGenericKind(component),
    target: component,
    selected: component
  };
}

const TYPOGRAPHY_KINDS = new Set<InspectorKind>([
  'heading',
  'paragraph',
  'rich-text',
  'list',
  'link',
  'button',
  'watermark',
  'header',
  'footer',
  'address',
  'organization',
  'contact-card',
  'social-icons',
  'generic'
]);

const LAYOUT_KINDS = new Set<InspectorKind>([
  'section',
  'container',
  'row',
  'column',
  'spacer',
  'divider',
  'header',
  'footer',
  'layout-grid-row',
  'layout-grid-cell',
  'generic'
]);

const APPEARANCE_KINDS = new Set<InspectorKind>([
  'heading',
  'paragraph',
  'rich-text',
  'list',
  'link',
  'button',
  'section',
  'container',
  'row',
  'column',
  'spacer',
  'divider',
  'header',
  'footer',
  'watermark',
  'totals',
  'tax-summary',
  'address',
  'organization',
  'contact-card',
  'social-icons',
  'image',
  'logo',
  'icon',
  'qr-code',
  'barcode',
  'signature',
  'html',
  'generic'
]);

export function inspectorShowsTypography(kind: InspectorKind): boolean {
  return TYPOGRAPHY_KINDS.has(kind);
}

export function inspectorShowsLayout(kind: InspectorKind): boolean {
  return LAYOUT_KINDS.has(kind);
}

export function inspectorShowsAppearance(kind: InspectorKind): boolean {
  return APPEARANCE_KINDS.has(kind);
}

export function inspectorIconType(kind: InspectorKind): string {
  const icons: Partial<Record<InspectorKind, string>> = {
    'line-item': 'LineItem',
    'merge-field': 'MergeTag',
    variable: 'Variable',
    formula: 'Formula',
    conditional: 'ConditionalBlock',
    loop: 'Loop',
    repeater: 'Repeater',
    'related-records': 'RelatedRecords',
    totals: 'Totals',
    'tax-summary': 'TaxSummary',
    address: 'AddressBlock',
    organization: 'OrganizationBlock',
    'contact-card': 'ContactCard',
    'qr-code': 'QrCode',
    barcode: 'Barcode',
    signature: 'Signature',
    logo: 'Logo',
    icon: 'Icon',
    image: 'Image',
    link: 'Link',
    button: 'Button',
    heading: 'Heading',
    paragraph: 'Paragraph',
    'rich-text': 'RichText',
    list: 'List',
    html: 'Html',
    section: 'Section',
    container: 'Container',
    row: 'Row',
    column: 'Column',
    spacer: 'Spacer',
    divider: 'Divider',
    header: 'Header',
    footer: 'Footer',
    watermark: 'Watermark',
    'page-break': 'PageBreak',
    'page-number': 'PageNumber',
    'social-icons': 'SocialIcons',
    'layout-grid-row': 'Row',
    'layout-grid-cell': 'Column',
    'table-cell': 'Table'
  };
  return icons[kind] || 'DocumentText';
}

export function inspectorLabelKey(kind: InspectorKind): string {
  const keys: Partial<Record<InspectorKind, string>> = {
    'line-item': 'templates.builderComponentLineItem',
    'merge-field': 'templates.builderComponentMergeField',
    variable: 'templates.builderComponentVariable',
    formula: 'templates.builderComponentFormula',
    conditional: 'templates.builderComponentConditionalBlock',
    loop: 'templates.builderComponentLoop',
    repeater: 'templates.builderComponentRepeater',
    'related-records': 'templates.builderComponentRelatedRecords',
    totals: 'templates.builderComponentTotals',
    'tax-summary': 'templates.builderComponentTaxSummary',
    address: 'templates.builderComponentAddressBlock',
    organization: 'templates.builderComponentOrganizationBlock',
    'contact-card': 'templates.builderComponentContactCard',
    'qr-code': 'templates.builderComponentQrCode',
    barcode: 'templates.builderComponentBarcode',
    signature: 'templates.builderComponentSignature',
    logo: 'templates.builderComponentLogo',
    icon: 'templates.builderComponentIcon',
    image: 'templates.builderComponentImage',
    link: 'templates.builderComponentLink',
    button: 'templates.builderComponentButton',
    heading: 'templates.builderComponentHeading',
    paragraph: 'templates.builderComponentParagraph',
    'rich-text': 'templates.builderComponentRichText',
    list: 'templates.builderComponentList',
    html: 'templates.builderComponentHtml',
    section: 'templates.builderComponentSection',
    container: 'templates.builderComponentContainer',
    row: 'templates.builderComponentRow',
    column: 'templates.builderComponentColumn',
    spacer: 'templates.builderComponentSpacer',
    divider: 'templates.builderComponentDivider',
    header: 'templates.builderComponentHeader',
    footer: 'templates.builderComponentFooter',
    watermark: 'templates.builderComponentWatermark',
    'page-break': 'templates.builderComponentPageBreak',
    'page-number': 'templates.builderComponentPageNumber',
    'social-icons': 'templates.builderComponentSocialIcons',
    'layout-grid-row': 'templates.builderComponentRow',
    'layout-grid-cell': 'templates.builderComponentColumn'
  };
  return keys[kind] || 'templates.builderPropertiesEmpty';
}
