import type { Report } from './report';

export function createRecoverySerializer() {
  const images = new WeakMap<Report['assets'], string>();
  const documents = new WeakMap<Report, string>();
  return (reports: Report[]) => `[${reports.map(report => {
    const cached = documents.get(report);
    if (cached !== undefined) return cached;
    const { assets, ...fields } = report;
    let serializedImages = images.get(assets);
    if (serializedImages === undefined) {
      serializedImages = JSON.stringify(assets);
      images.set(assets, serializedImages);
    }
    // Assets are updated immutably; reuse their JSON while text fields change.
    const serialized = `${JSON.stringify(fields).slice(0, -1)},"assets":${serializedImages}}`;
    documents.set(report, serialized);
    return serialized;
  }).join(',')}]`;
}
