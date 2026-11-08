import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createReport, getAt, setAt, parseWorkspace, serializeWorkspace, tableChange, importCsv, importAttackFlow } from '../src/report';

describe('report persistence', () => {
  it('preserves upstream and unknown fields through a workspace round trip', () => {
    const upstream = JSON.parse(readFileSync('tests/fixtures/An Example Campaign Report.json', 'utf8'));
    upstream.vendor_extension = { untouched: [1, 2] };
    const report = createReport('a2d30a3c-49b5-42e5-a4cb-649009fa4c9d', upstream);
    const restored = parseWorkspace(serializeWorkspace(report));
    expect(restored.data).toEqual(upstream);
  });
  it('updates nested fields without mutating original data', () => {
    const original = { iocs: { network: [{ artifact: 'one' }] }, keep: true };
    const changed = setAt(original, 'iocs.network', [{ artifact: 'two' }]);
    expect(getAt(changed, 'iocs.network')).toEqual([{ artifact: 'two' }]);
    expect(original.iocs.network[0].artifact).toBe('one');
  });
  it('rejects malformed workspace input', () => {
    expect(() => parseWorkspace('{"format":"cti-workbench","data":[]}')).toThrow();
  });
});

describe('structured tables', () => {
  it('duplicates and reorders without modifying the original row', () => {
    const rows = [{ value: 'a' }, { value: 'b' }];
    const duplicate = tableChange(rows, 'duplicate', 0);
    expect(duplicate).toEqual([{ value: 'a' }, { value: 'a' }, { value: 'b' }]);
    expect(tableChange(duplicate, 'down', 1)).toEqual([{ value: 'a' }, { value: 'b' }, { value: 'a' }]);
    expect(rows).toHaveLength(2);
  });
  it('imports quoted CSV columns using field names', () => {
    expect(importCsv('Artifact,Details\nexample,"one, two"', [{ id: 'artifact', name: 'Artifact' }, { id: 'details', name: 'Details' }])).toEqual([{ artifact: 'example', details: 'one, two' }]);
  });
  it('parses numeric CSV fields and rejects invalid numeric values', () => {
    const fields = [{ id: 'score', name: 'Score', type: 2 }];
    expect(importCsv('Score\n9.8', fields)).toEqual([{ score: 9.8 }]);
    expect(() => importCsv('Score\nnot-a-number', fields)).toThrow('Score');
  });
  it('imports ATT&CK identifiers from published Attack Flow actions', () => {
    expect(importAttackFlow(JSON.stringify({ objects: [{ type: 'attack-action', technique_id: 'T1001.003' }, { type: 'attack-action', tactic_id: 'TA0001' }] }))).toEqual([
      { tactic: 'TA0011', technique: 'T1001', sub_technique: 'T1001.003' }, { tactic: 'TA0001' }
    ]);
  });
});
