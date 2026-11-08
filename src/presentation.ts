import { fieldPath, getAt, resolveImages, type Data, type Report, type Template, type Field } from './report';

export interface ExportItem { name: string; value: string | Data[]; fields?: Field[] }
export interface ExportSection { name: string; items: ExportItem[] }
export function buildExportSections(report: Report, template: Template, selected: string[]): ExportSection[] {
  return template.sections.filter(s => selected.includes(s.id)).map(section => ({
    name: section.name || template.name,
    items: section.properties.flatMap<ExportItem>(field => {
      const value = getAt(report.data, fieldPath(section, field));
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return [];
      if (Array.isArray(value)) return [{ name: field.name, value: value as Data[], fields: field.properties || [] }];
      return [{ name: field.name, value: resolveImages(String(value), report.assets) }];
    })
  })).filter(s => s.items.length);
}
