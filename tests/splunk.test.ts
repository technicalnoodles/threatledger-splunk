import { describe, expect, it } from 'vitest';
import { createReport, templates } from '../src/report';
import { createSplunkClient, searchUrl, safeSplunkReferenceUrl } from '../src/splunk';

const report = () => createReport(templates[0].id, { report_title: 'Investigation' });

describe('Splunk links', () => {
  it('encodes SPL and time bounds into a same-origin search link', () => {
    const href = searchUrl({ id: 's', title: 'Query', kind: 'adhoc', query: 'index=foo | search host="a b"', earliest: '1794085200', latest: '1794173039', app: 'search', note: '' }, '/en-US');
    const url = new URL(href, 'https://splunk.example');
    expect(url.pathname).toBe('/en-US/app/search/search');
    expect(url.searchParams.get('q')).toBe('index=foo | search host="a b"');
    expect(url.searchParams.get('earliest')).toBe('1794085200');
  });
  it('does not run an uncaptured saved report with a moving time range', () => {
    expect(() => searchUrl({ id: 's', title: 'Saved', kind: 'saved', query: '', earliest: '', latest: '', app: 'search', note: '', savedName: 'Auth failures', savedOwner: 'nobody' }, '/en-US')).toThrow(/captured SPL/i);
  });
  it('rejects external and script finding links', () => {
    expect(safeSplunkReferenceUrl('https://evil.example/a', 'https://splunk.example')).toBeNull();
    expect(safeSplunkReferenceUrl('javascript:alert(1)', 'https://splunk.example')).toBeNull();
    expect(safeSplunkReferenceUrl('/en-US/app/SplunkEnterpriseSecuritySuite/incident_review', 'https://splunk.example')).toContain('/en-US/app/');
  });
});

describe('shared report storage', () => {
  it('saves, lists and reads a report with its reference metadata', async () => {
    const records = new Map<string, any>();
    const fetcher: typeof fetch = async (input, init) => {
      const path = new URL(String(input), 'https://splunk.example').pathname;
      const key = path.split('/').pop()!;
      if (init?.method === 'POST') { const doc = JSON.parse(String(init.body)); records.set(doc._key, doc); return new Response(JSON.stringify({ _key: doc._key }), { status: 200 }); }
      if (key === 'reports') return new Response(JSON.stringify([...records.values()]), { status: 200 });
      return records.has(key) ? new Response(JSON.stringify(records.get(key)), { status: 200 }) : new Response('', { status: 404 });
    };
    const client = createSplunkClient({ prefix: '/en-US', fetcher, csrf: () => 'token' });
    const data = report();
    const saved = await client.save(data, null);
    expect(saved.revision).toBeTruthy();
    expect((await client.list())[0].report_id).toBe(data.id);
    expect((await client.load(data.id)).report).toEqual(data);
    await expect(client.save(data, 'outdated')).rejects.toThrow(/changed/i);
  });
  it('does not write after an authorization failure', async () => {
    let writes = 0;
    const client = createSplunkClient({ prefix: '/en-US', csrf: () => 'token', fetcher: async (_input, init) => { if (init?.method === 'POST') writes++; return new Response('', { status: 403 }); } });
    await expect(client.save(report(), null)).rejects.toThrow(/403/);
    expect(writes).toBe(0);
  });
  it('rejects an oversized report without writing to the collection', async () => {
    let writes = 0;
    const client = createSplunkClient({ prefix: '/en-US', csrf: () => 'token', fetcher: async (_input, init) => {
      if (init?.method === 'POST') writes++;
      return new Response('', { status: 404 });
    } });
    const data = report();
    data.assets.large = `data:image/png;base64,${'A'.repeat(15 * 1024 * 1024)}`;
    await expect(client.save(data, null)).rejects.toThrow(/too large/i);
    expect(writes).toBe(0);
    expect(data.assets.large).toHaveLength(15 * 1024 * 1024 + 'data:image/png;base64,'.length);
  });
  it('reports a missing shared report without modifying local data', async () => {
    const data = report();
    const client = createSplunkClient({ prefix: '/en-US', fetcher: async () => new Response('', { status: 404 }) });
    await expect(client.load(data.id)).rejects.toThrow(/not found or is unavailable/i);
    expect(data.data.report_title).toBe('Investigation');
  });
});
