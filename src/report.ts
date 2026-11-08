import Papa from 'papaparse';
import rawTemplates from './templates.json';
import { getTacticFromTechnique } from './attackMaps';

export type Data = Record<string, unknown>;
export interface Field { id: string; name: string; type?: number; path?: string; options?: {value: string; text: string}[]; properties?: Field[]; description?: string }
export interface Section { id: string; name?: string; path?: string; properties: Field[] }
export interface Template { id: string; name: string; description: string; sections: Section[] }
export interface Report { format: 'cti-workbench'; version: 1; id: string; templateId: string; data: Data; assets: Record<string, string> }
export const templates = rawTemplates as Template[];

export function createReport(templateId: string, data: Data = {}): Report {
  if (!templates.some(t => t.id === templateId)) throw new Error('Unknown report template.');
  return { format: 'cti-workbench', version: 1, id: crypto.randomUUID(), templateId, data: structuredClone(data), assets: {} };
}
export function serializeWorkspace(report: Report): string { return JSON.stringify(report, null, 2); }
export function parseWorkspace(input: string): Report {
  const value: unknown = JSON.parse(input);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The file must contain a report object.');
  const doc = value as Record<string, unknown>;
  if (doc.format !== 'cti-workbench' || doc.version !== 1 || typeof doc.id !== 'string' || typeof doc.templateId !== 'string' || !templates.some(t => t.id === doc.templateId) || !doc.data || typeof doc.data !== 'object' || Array.isArray(doc.data)) throw new Error('This is not a supported ThreatLedger file.');
  if (doc.assets !== undefined && (!doc.assets || typeof doc.assets !== 'object' || Array.isArray(doc.assets) || Object.values(doc.assets).some(v => typeof v !== 'string'))) throw new Error('Invalid workspace images.');
  return { ...doc, assets: doc.assets || {} } as unknown as Report;
}
export function resolveImages(value: string, assets: Record<string, string>): string {
  return value.replace(/cti-image:([a-zA-Z0-9-]+)/g, (match, id: string) => assets[id] || match);
}
export function materializeImages(value: unknown, assets: Record<string, string>): unknown {
  if (typeof value === 'string') return resolveImages(value, assets);
  if (Array.isArray(value)) return value.map(item => materializeImages(item, assets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materializeImages(item, assets)]));
  return value;
}
export function fieldPath(section: Section, field: Field): string {
  return (field.path || `${section.path || '*'}.${field.id}`).replace(/^\*\.?/, '');
}
const pathParts = (path: string) => {
  const parts = path.split('.').filter(Boolean);
  if (parts.some(p => ['__proto__', 'prototype', 'constructor'].includes(p))) throw new Error('Unsafe field path');
  return parts;
};
export function getAt(data: Data, path: string): unknown {
  return pathParts(path).reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Data)[key] : undefined, data);
}
export function setAt(data: Data, path: string, value: unknown): Data {
  const parts = pathParts(path); if (!parts.length) return data;
  const copy = structuredClone(data); let cursor = copy;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) cursor[part] = {};
    cursor = cursor[part] as Data;
  }
  cursor[parts[parts.length - 1]] = value; return copy;
}
export function tableChange(rows: Data[], action: 'add' | 'duplicate' | 'delete' | 'up' | 'down', index = 0): Data[] {
  const result = structuredClone(rows);
  if (action === 'add') result.push({});
  if (action === 'duplicate' && result[index]) result.splice(index + 1, 0, structuredClone(result[index]));
  if (action === 'delete') result.splice(index, 1);
  const target = index + (action === 'up' ? -1 : action === 'down' ? 1 : 0);
  if (target !== index && target >= 0 && target < result.length) [result[index], result[target]] = [result[target], result[index]];
  return result;
}
export function importCsv(text: string, fields: Pick<Field, 'id' | 'name' | 'type'>[]): Data[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const error = parsed.errors.find(e => e.code !== 'UndetectableDelimiter');
  if (error) throw new Error(`CSV error: ${error.message}`);
  const normalized = (s: string) => s.trim().toLowerCase();
  const lookup = new Map(fields.flatMap(f => [[normalized(f.name), f], [normalized(f.id), f]] as [string, Pick<Field, 'id'|'name'|'type'>][]));
  if (!(parsed.meta.fields || []).some(f => lookup.has(normalized(f)))) throw new Error('No CSV headers match this table’s field names.');
  return parsed.data.map(row => Object.fromEntries(Object.entries(row).flatMap<[string, unknown]>(([key, value]) => {
    const field = lookup.get(normalized(key)); if (!field) return [];
    if ((field.type === 1 || field.type === 2) && value.trim()) {
      const number = Number(value); if (!Number.isFinite(number) || (field.type === 1 && !Number.isInteger(number))) throw new Error(`${field.name} must be ${field.type === 1 ? 'an integer' : 'a number'}.`);
      return [[field.id, number]];
    }
    return [[field.id, value]];
  })));
}
export function importAttackFlow(text: string): Data[] {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.objects)) throw new Error('Expected a published Attack Flow JSON bundle with an objects array.');
  return data.objects.flatMap((obj: Data) => {
    if (!obj || obj.type !== 'attack-action') return [];
    const match = typeof obj.technique_id === 'string' ? /^(T\d{4})(?:\.\d{3})?$/i.exec(obj.technique_id) : null;
    const tactic = typeof obj.tactic_id === 'string' && /^TA\d{4}$/i.test(obj.tactic_id) ? obj.tactic_id.toUpperCase() : undefined;
    if (match) {
      const technique = match[1].toUpperCase(); const id = (obj.technique_id as string).toUpperCase();
      return [{ tactic: tactic || getTacticFromTechnique(technique), technique, ...(id.includes('.') ? { sub_technique: id } : {}) }];
    }
    return tactic ? [{ tactic }] : [];
  });
}
