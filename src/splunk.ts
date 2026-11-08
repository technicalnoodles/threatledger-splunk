import { parseWorkspace, type Report, type SearchReference } from './report';
import { absoluteTime, containsTimeModifiers, fixedTimeRange } from './searchTime';
import { mapEsRecord } from './esFinding';

export interface SharedReport { _key: string; report_id: string; title: string; template_id: string; revision: string; updated_at: string; report_path: string; finding_ids: string; workspace: Report }
export interface StorageOptions { prefix: string; fetcher?: typeof fetch; csrf?: () => string | undefined }
const MAX_RECORD_BYTES = 15 * 1024 * 1024;
const safeName = (s: string) => /^[A-Za-z0-9_.-]+$/.test(s) && s !== '.' && s !== '..';
const esc = encodeURIComponent;
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const knownFlag = (value: unknown) => value === true || value === false || value === 1 || value === 0 || value === '1' || value === '0' || value === 'true' || value === 'false';
const validSegment = (value: string) => !!value && value !== '.' && value !== '..' && !/[\\/\x00-\x1f]/.test(value);
const hasIndexTime = (value: unknown) => !!value && typeof value === 'object' && Object.entries(value).some(([key, entry]) => /(?:^|[._])index_(?:earliest|latest)$/i.test(key) && entry !== undefined && entry !== null && String(entry).trim() !== '');

export function splunkPrefix(path: string): string | null {
  const marker = '/app/threatledger/';
  const index = path.indexOf(marker);
  return index < 0 ? null : path.slice(0, index);
}
export function safeSplunkReferenceUrl(value: string, origin: string): string | null {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || !/^https?:$/.test(url.protocol) || !url.pathname.includes('/app/')) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}
export function searchUrl(search: SearchReference, prefix: string): string {
  if (!safeName(search.app)) throw new Error('Invalid Splunk app name.');
  if (!search.query.trim()) throw new Error('This reference has no captured SPL. Edit it to capture a fixed search.');
  if (containsTimeModifiers(search.query)) throw new Error('SPL time modifiers, dynamic time functions, or savedsearch/loadjob commands can change the search window. Replace them with fixed values before opening the search.');
  const range = fixedTimeRange(search.earliest, search.latest);
  const params = new URLSearchParams({ q: search.query, ...range });
  return `${prefix}/app/${esc(search.app)}/search?${params}`;
}
function csrfCookie(): string | undefined {
  const cookie = document.cookie.split('; ').find(v => /^splunkweb_csrf_token_\d+=/.test(v));
  return cookie ? decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1)) : undefined;
}
export function createSplunkClient({ prefix, fetcher = fetch, csrf = csrfCookie }: StorageOptions) {
  const base = `${prefix}/splunkd/__raw/servicesNS/nobody/threatledger/storage/collections/data/reports`;
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (init.method === 'POST') {
      const token = csrf();
      if (!token) throw new Error('Splunk session security token unavailable. Reload Splunk and sign in again.');
      headers.set('X-Splunk-Form-Key', token);
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetcher(path, { ...init, headers, credentials: 'same-origin', redirect: 'error' });
    if (!res.ok && res.status !== 404) throw new Error(`Splunk request failed (${res.status}). Check your access and Splunk status.`);
    return res;
  }
  async function read(id: string): Promise<SharedReport | null> {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid report ID.');
    const res = await request(`${base}/${esc(id)}`);
    if (res.status === 404) return null;
    const value = await res.json() as SharedReport;
    value.workspace = parseWorkspace(JSON.stringify(value.workspace));
    return value;
  }
  return {
    async loadEsRecord(input: string) {
      const id = input.trim();
      if (/^ES-\d{1,12}$/i.test(id)) {
        const canonical = id.toUpperCase();
        const digits = canonical.slice(3);
        const padded = `ES-${digits.padStart(5, '0')}`;
        const candidates = [...new Set([canonical, padded])];
        for (const candidate of candidates) {
          const params = new URLSearchParams({ ids: candidate, limit: '2', output_mode: 'json' });
          const res = await request(`${prefix}/splunkd/__raw/servicesNS/nobody/missioncontrol/public/v2/investigations?${params}`);
          if (res.status === 404) continue;
          const payload: unknown = await res.json();
          const items = Array.isArray(payload) ? payload : (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items) ? (payload as { items: unknown[] }).items : []);
          const exact = items.filter((value): value is Record<string, unknown> => !!value && typeof value === 'object' && (value as Record<string, unknown>).investigation_id === candidate);
          if (exact.length > 1) throw new Error('ES returned more than one record with this ID.');
          if (exact.length === 1) {
            const record = exact[0];
            const type = flag(record.is_investigation) ? 'investigation' : flag(record.is_finding_group) ? 'finding_group' : knownFlag(record.is_investigation) && knownFlag(record.is_finding_group) ? 'finding' : 'record';
            return mapEsRecord(record, candidate, type, prefix);
          }
        }
        throw new Error('ES record not found or unavailable. Check the ID and your access.');
      }
      const match = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})@@notable@@(time(\d{10})|[a-f0-9]{32})$/i.exec(id);
      if (!match) throw new Error('Enter an ES display ID such as ES-00123 or a complete finding event_id.');
      const earliest = match[3] ? String(Math.max(0, Number(match[3]) - 300)) : '-30d';
      const params = new URLSearchParams({ earliest, output_mode: 'json' });
      const res = await request(`${prefix}/splunkd/__raw/servicesNS/nobody/SplunkEnterpriseSecuritySuite/public/v2/findings/${esc(id)}?${params}`);
      if (res.status === 404) throw new Error('Finding not found or unavailable to your account. Older findings may need an event ID with its time.');
      const record: unknown = await res.json();
      if (!record || typeof record !== 'object' || Array.isArray(record) || (record as Record<string, unknown>).event_id !== id) throw new Error('Finding not found or the returned ID did not match.');
      return mapEsRecord(record as Record<string, unknown>, id, 'finding', prefix);
    },
    async resolveTimeRange(earliest: string, latest: string) {
      const values = [...new Set([earliest.trim(), latest.trim(), 'now'])];
      if (values.some(value => !value || /^rt/i.test(value))) throw new Error('Enter a historical time range; real-time searches cannot be frozen.');
      const params = new URLSearchParams({ output_mode: 'json' });
      values.forEach(value => params.append('time', value));
      const res = await request(`${prefix}/splunkd/__raw/services/search/timeparser?${params}`);
      if (res.status === 404) throw new Error('Splunk time parser is unavailable. Enter absolute times or check your access.');
      const result = await res.json() as Record<string, unknown>;
      if (values.some(value => typeof result[value] !== 'string')) throw new Error('Splunk could not resolve this time range.');
      return { ...fixedTimeRange(result[earliest.trim()] as string, result[latest.trim()] as string), capturedAt: new Date(Number(absoluteTime(result.now as string)) * 1000).toISOString() };
    },
    async loadSearchJob(sid: string) {
      if (!/^[A-Za-z0-9_.:-]{1,512}$/.test(sid) || sid === '.' || sid === '..') throw new Error('Invalid Splunk search job ID.');
      const res = await request(`${prefix}/splunkd/__raw/services/search/jobs/${esc(sid)}?output_mode=json`);
      if (res.status === 404) throw new Error('Search job not found or expired. Enter the original absolute range manually.');
      const payload = await res.json() as { entry?: Array<{ content?: Record<string, any> }> };
      const job = payload.entry?.[0]?.content;
      if (!job || !flag(job.isDone) || flag(job.isFailed) || flag(job.isRealTimeSearch)) throw new Error('Select a completed, successful historical search job.');
      if (hasIndexTime(job) || hasIndexTime(job.request)) throw new Error('Separate index-time bounds cannot be preserved in this reference.');
      const query = job.request?.search || job.search;
      if (typeof query !== 'string' || !query.trim()) throw new Error('The search job does not expose its original SPL.');
      if (job.searchEarliestTime == null || job.searchLatestTime == null) throw new Error('The search job does not expose both resolved time bounds. Enter the original absolute range manually.');
      const range = fixedTimeRange(job.searchEarliestTime, job.searchLatestTime);
      const app = job.request?.ui_dispatch_app || job['eai:acl']?.app || 'search';
      if (typeof app !== 'string' || !safeName(app)) throw new Error('The search job has an invalid app context.');
      return { query, ...range, app, sourceJobId: sid };
    },
    async loadSavedSearch(app: string, owner: string, name: string) {
      if (!safeName(app) || !validSegment(owner) || !validSegment(name)) throw new Error('Enter a valid saved report app, owner, and name.');
      const res = await request(`${prefix}/splunkd/__raw/servicesNS/${esc(owner)}/${esc(app)}/saved/searches/${esc(name)}?output_mode=json`);
      if (res.status === 404) throw new Error('Saved report not found or unavailable.');
      const payload = await res.json() as { entry?: Array<{ content?: Record<string, unknown> }> };
      const definition = payload.entry?.[0]?.content;
      if (hasIndexTime(definition)) throw new Error('Separate index-time bounds cannot be preserved in this reference.');
      const query = definition?.search;
      if (typeof query !== 'string' || !query.trim()) throw new Error('The saved report does not expose its SPL.');
      return query;
    },
    async list(): Promise<SharedReport[]> {
      const res = await request(`${base}?limit=0&fields=report_id,title,template_id,revision,updated_at,report_path,finding_ids`);
      if (res.status === 404) throw new Error('Splunk reports collection was not found. Check app installation and permissions.');
      const result: unknown = await res.json();
      if (!Array.isArray(result)) throw new Error('Invalid report catalog response.');
      return result as SharedReport[];
    },
    async load(id: string) {
      const value = await read(id);
      if (!value) throw new Error('The shared report was not found or is unavailable.');
      return { report: value.workspace, revision: value.revision };
    },
    async save(report: Report, expectedRevision: string | null) {
      const current = await read(report.id);
      if ((current?.revision || null) !== expectedRevision) throw new Error('The shared report changed since it was opened. Download your workspace and reopen the shared report before saving.');
      const record: SharedReport = { _key: report.id, report_id: report.id, title: String(report.data.report_title || 'Untitled report'), template_id: report.templateId, revision: crypto.randomUUID(), updated_at: new Date().toISOString(), report_path: `${prefix}/app/threatledger/threatledger?report=${esc(report.id)}`, finding_ids: (report.references?.findings || []).map(f => f.sourceId || f.id).join(', '), workspace: report };
      const body = JSON.stringify(record);
      if (new TextEncoder().encode(body).length > MAX_RECORD_BYTES) throw new Error('Report is too large for shared storage. Download the workspace or reduce embedded images.');
      const res = await request(current ? `${base}/${esc(report.id)}` : base, { method: 'POST', body });
      if (res.status === 404) throw new Error('The reports collection was not found.');
      return { revision: record.revision };
    },
  };
}
