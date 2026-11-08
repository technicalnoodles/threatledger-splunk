export type EsSourceType = 'finding' | 'finding_group' | 'investigation' | 'record';
export interface EsRecordPreview { title: string; sourceId: string; sourceUrl: string; description: string; esSourceType: EsSourceType; esImportedAt: string }

/** Copy only analyst-useful fields; never copy raw events or arbitrary custom fields. */
export function mapEsRecord(record: Record<string, unknown>, sourceId: string, type: EsSourceType, prefix: string): EsRecordPreview {
  const text = (...keys: string[]): string => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 4000);
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      if (Array.isArray(value)) {
        const values = value.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number').map(String).filter(Boolean);
        if (values.length) return values.join(', ').slice(0, 4000);
      }
    }
    return '';
  };
  const title = text('rule_title', 'name', 'rule_name', 'title');
  if (!title) throw new Error('The ES record has no title to import.');
  const description = text('rule_description', 'description');
  const sourceTime = text('_time', 'orig_time', 'create_time');
  const asNumber = /^\d+(?:\.\d+)?$/.test(sourceTime) ? Number(sourceTime) : NaN;
  const millis = Number.isFinite(asNumber) ? (asNumber >= 1e12 ? asNumber : asNumber * 1000) : (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(sourceTime) ? Date.parse(sourceTime) : NaN);
  const eventTime = Number.isFinite(millis) && Math.abs(millis) <= 8640000000000000 ? new Date(millis).toISOString() : sourceTime;
  const fields: [string, string][] = [
    ['Record type', type === 'finding_group' ? 'Finding group' : type === 'investigation' ? 'Investigation' : type === 'finding' ? 'Finding' : 'ES record'],
    ['Status', text('status_name', 'status_label', 'status')],
    ['Urgency', text('urgency')],
    ['Severity', text('severity')],
    ['Owner', text('owner_realname', 'owner')],
    ['Entity', text('risk_object', 'entity')],
    ['Risk score', text('risk_score')],
    ['Security domain', text('security_domain')],
    ['Event time', eventTime],
  ];
  const metadata = fields.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n');
  let sourceUrl = '';
  const guid = text('investigation_guid');
  const queue = text('queue_id');
  if (type !== 'finding' && /^[a-f0-9-]{36}$/i.test(guid) && queue) {
    sourceUrl = `${prefix}/app/SplunkEnterpriseSecuritySuite/mission_control?${new URLSearchParams({ queueId: queue, ticketId: guid })}`;
  }
  return { title, sourceId, sourceUrl, description: [description, metadata].filter(Boolean).join('\n\n'), esSourceType: type, esImportedAt: new Date().toISOString() };
}
