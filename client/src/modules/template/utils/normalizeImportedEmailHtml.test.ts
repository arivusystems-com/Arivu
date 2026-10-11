import { describe, expect, it } from 'vitest';
import { normalizeImportedEmailHtml } from './normalizeImportedEmailHtml';

describe('normalizeImportedEmailHtml', () => {
  it('promotes align attribute to text-align style on cells', () => {
    const html = '<td align="center" style="padding:8px">Hi</td>';
    expect(normalizeImportedEmailHtml(html)).toContain('text-align:center');
    expect(normalizeImportedEmailHtml(html)).toContain('align="center"');
  });

  it('does not promote table align to text-align (Outlook table positioning)', () => {
    const html = '<table align="center" width="600"><tr><td>Hi</td></tr></table>';
    const out = normalizeImportedEmailHtml(html);
    expect(out).toContain('align="center"');
    expect(out).not.toMatch(/<table[^>]*text-align\s*:/i);
  });

  it('strips wrongly promoted text-align from aligned tables', () => {
    const html = '<table style="text-align:center;" align="center"><tr><td>Hi</td></tr></table>';
    const out = normalizeImportedEmailHtml(html);
    expect(out).toContain('align="center"');
    expect(out).not.toMatch(/<table[^>]*text-align\s*:/i);
  });

  it('collapses pretty-print newlines between tags', () => {
    const html = `<td align="center">
      <p>Hello</p>
    </td>`;
    const out = normalizeImportedEmailHtml(html);
    expect(out).not.toMatch(/>\s*\n\s*</);
    expect(out).toContain('text-align:center');
  });

  it('trims whitespace inside block tags', () => {
    const html = '<td>   Hi there   </td>';
    expect(normalizeImportedEmailHtml(html)).toContain('<td>Hi there</td>');
  });

  it('keeps intentional spaces between inline text and tags', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(normalizeImportedEmailHtml(html)).toContain('Hello <strong>world</strong>');
  });
});
