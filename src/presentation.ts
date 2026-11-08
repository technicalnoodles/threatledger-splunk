import { safeSplunkReferenceUrl, searchUrl } from './splunk';
import { describeFixedRange } from './searchTime';
import { fieldPath, getAt, resolveImages, type Data, type Report, type Template, type Field } from './report';

export interface ExportItem { name: string; value: string | Data[]; fields?: Field[]; link?: string }
export interface ExportSection { name: string; items: ExportItem[] }
export function buildExportSections(report: Report, template: Template, selected: string[], context?: { origin: string; prefix: string }): ExportSection[] {
  const sections = template.sections.filter(s => selected.includes(s.id)).map(section => ({
    name: section.name || template.name,
    items: section.properties.flatMap<ExportItem>(field => {
      const value = getAt(report.data, fieldPath(section, field));
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return [];
      if (Array.isArray(value)) return [{ name: field.name, value: value as Data[], fields: field.properties || [] }];
      return [{ name: field.name, value: resolveImages(String(value), report.assets) }];
    })
  })).filter(s => s.items.length);
  if (selected.includes('references') && report.references) {
    const findingLink = (value: string) => {
      if (!context || !value) return undefined;
      const safe = safeSplunkReferenceUrl(value, context.origin);
      return safe ? new URL(safe, context.origin).href : undefined;
    };
    const searchLink = (search: NonNullable<Report['references']>['searches'][number]) => {
      if (!context) return undefined;
      try { return new URL(searchUrl(search, context.prefix), context.origin).href; } catch { return undefined; }
    };
    const formatRange = (search: NonNullable<Report['references']>['searches'][number]) => {
      try {
        return `Fixed time: ${describeFixedRange(search.earliest, search.latest)}`;
      } catch { return `Original time was not saved; recorded range: ${search.earliest} to ${search.latest}`; }
    };
    const items: ExportItem[] = [
      ...report.references.findings.map(f => ({ name: `Finding: ${f.title}`, value: [f.description, f.sourceId && `Source ID: ${f.sourceId}`, f.sourceUrl && `Source: ${f.sourceUrl}`].filter(Boolean).join('\n\n'), link: findingLink(f.sourceUrl) })),
      ...report.references.searches.map(s => ({ name: `Search: ${s.title}`, value: [s.kind === 'saved' && `Saved search: ${s.savedName || ''}`, s.query && `SPL: ${s.query}`, formatRange(s), s.sourceJobId && `Source search job: ${s.sourceJobId}`, `App: ${s.app}`, s.note].filter(Boolean).join('\n\n'), link: searchLink(s) })),
    ];
    if (items.length) sections.push({ name: 'Findings and searches', items });
  }
  return sections;
}
