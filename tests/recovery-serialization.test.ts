import { describe, expect, it } from 'vitest';
import { createRecoverySerializer } from '../src/recovery';
import { createReport, templates } from '../src/report';

describe('recovery serialization', () => {
  it('preserves report data, images and unfamiliar properties across edits', () => {
    const serialize = createRecoverySerializer();
    const original = { ...createReport(templates[0].id, { report_title: 'First' }), assets: { image: 'data:image/png;base64,aGVsbG8=' }, extra: { value: 42 } };
    expect(JSON.parse(serialize([original]))).toEqual([original]);
    const edited = { ...original, data: { report_title: 'Updated' } };
    expect(JSON.parse(serialize([edited]))).toEqual([edited]);
    const withImage = { ...edited, assets: { ...edited.assets, second: 'data:image/png;base64,d29ybGQ=' } };
    expect(JSON.parse(serialize([withImage]))).toEqual([withImage]);
  });
  it('does not read unchanged image data again for text edits', () => {
    let reads = 0;
    const assets = Object.defineProperty({}, 'image', { enumerable: true, get: () => { reads++; return 'data:image/png;base64,aGVsbG8='; } });
    const report = { ...createReport(templates[0].id), assets };
    const serialize = createRecoverySerializer();
    serialize([report]);
    const initialReads = reads;
    serialize([{ ...report, data: { report_title: 'Edited' } }]);
    expect(reads).toBe(initialReads);
  });
});
