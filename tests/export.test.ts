import { describe, expect, it } from 'vitest';
import { createReport, templates } from '../src/report';
import { buildExportSections, createPdf, createWord } from '../src/export';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { unzipSync, strFromU8 } from 'fflate';
import { readFileSync } from 'node:fs';

describe('document export', () => {
  it('includes only selected sections and preserves nested table data', () => {
    const template = templates.find(t => t.name === 'Campaign Report')!;
    const report = createReport(template.id, { report_title: 'A report', executive_summary: '**Key finding**', timeline: [{ attribution: 'GROUP-X', activity: 'Observed activity' }] });
    const sections = buildExportSections(report, template, ['general', 'timeline_of_activity']);
    expect(JSON.stringify(sections)).toContain('GROUP-X');
    expect(JSON.stringify(sections)).not.toContain('Key finding');
  });
  it('creates a real PDF and Word document', async () => {
    const template = templates.find(t => t.name === 'Executive Report')!;
    const report = createReport(template.id, { report_title: 'A report', executive_summary: 'Evidence based analysis' });
    const sections = buildExportSections(report, template, ['general', 'executive_summary']);
    const pdf = await createPdf('A report', sections);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    const word = await createWord('A report', sections);
    expect(Array.from(word.slice(0, 2))).toEqual([0x50, 0x4b]);
  });
  it('keeps Greek and accented text readable in PDF output', async () => {
    const template = templates.find(t => t.name === 'Executive Report')!;
    const report = createReport(template.id, { report_title: 'Résumé', executive_summary: 'Analyse naïve Αθηνα' });
    const bytes = await createPdf('Résumé', buildExportSections(report, template, ['executive_summary']));
    const pdf = await getDocument({data: bytes, useSystemFonts: true}).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    expect(content.items.map(item => 'str' in item ? item.str : '').join(' ')).toContain('Analyse naïve Αθηνα');
  });
  it('embeds a PNG in both export formats and keeps Word text editable', async () => {
    const template = templates.find(t => t.name === 'Executive Report')!;
    const image = readFileSync('tests/fixtures/test-image.png').toString('base64');
    const report = createReport(template.id, { executive_summary: `**Finding**\n\n![Evidence](data:image/png;base64,${image})` });
    const sections = buildExportSections(report, template, ['executive_summary']);
    const word = unzipSync(await createWord('Report', sections));
    expect(Object.keys(word).some(name => name.startsWith('word/media/'))).toBe(true);
    expect(strFromU8(word['word/document.xml'])).toContain('Finding');
    const pdf = await createPdf('Report', sections);
    expect(new TextDecoder('latin1').decode(pdf)).toContain('/Subtype /Image');
  });
  it('resolves workspace image references when exporting', () => {
    const template = templates.find(t => t.name === 'Executive Report')!;
    const report = createReport(template.id, { executive_summary: '![Evidence](cti-image:example)' });
    report.assets.example = 'data:image/png;base64,example';
    const sections = buildExportSections(report, template, ['executive_summary']);
    expect(JSON.stringify(sections)).toContain('data:image/png;base64,example');
  });
});
