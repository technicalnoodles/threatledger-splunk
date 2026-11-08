import { describe, expect, it } from 'vitest';
import { createReport, parseWorkspace, serializeWorkspace, templates } from '../src/report';
import { buildExportSections } from '../src/presentation';

describe('portable Splunk references', () => {
  it('round trips findings and linked searches along with unknown workspace fields', () => {
    const report = {
      ...createReport(templates[0].id),
      custom: { retained: true },
      references: {
        findings: [{ id: 'f1', title: 'Suspicious process', description: 'Observed execution', sourceId: 'ES-1', sourceUrl: '/en-US/app/SplunkEnterpriseSecuritySuite/incident_review' }],
        searches: [{ id: 's1', findingId: 'f1', title: 'Process search', kind: 'adhoc' as const, query: 'index=main | head 2', earliest: '-24h', latest: 'now', app: 'search', note: 'Review process events' }],
      },
    };
    expect(parseWorkspace(serializeWorkspace(report))).toEqual(report);
    const sections = buildExportSections(report, templates[0], [templates[0].sections[0].id, 'references']);
    expect(JSON.stringify(sections)).toContain('Suspicious process');
    expect(JSON.stringify(sections)).toContain('index=main | head 2');
  });

  it('rejects malformed reference metadata rather than losing it', () => {
    const report = { ...createReport(templates[0].id), references: { findings: 'invalid', searches: [] } };
    expect(() => parseWorkspace(JSON.stringify(report))).toThrow(/references/i);
  });
});

it('preserves unknown finding metadata in older workspace files', () => {
  const report = { ...createReport(templates[0].id), references: { findings: [{ id: 'f1', title: 'Imported', description: '', sourceId: 'x', sourceUrl: '', sourceType: 'other-vendor', importedAt: { version: 1 } }], searches: [] } };
  expect(parseWorkspace(JSON.stringify(report))).toEqual(report);
});
