import { describe, expect, it, vi } from 'vitest';
import { createSplunkClient, searchUrl } from '../src/splunk';
import { containsTimeModifiers, fixedTimeRange } from '../src/searchTime';
import type { SearchReference } from '../src/report';

const base: SearchReference = { id: 's1', title: 'Test', kind: 'adhoc', query: 'index=main | stats count', earliest: '1794085200', latest: '1794173039', app: 'search', note: '' };

describe('immutable search windows', () => {
  it('keeps the same epoch bounds when the link is opened days later', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T00:00:00Z'));
    const first = searchUrl(base, '/en-US');
    vi.setSystemTime(new Date('2026-11-15T00:00:00Z'));
    const second = searchUrl(base, '/en-US');
    expect(second).toBe(first);
    const url = new URL(second, 'https://example.com');
    expect(url.searchParams.get('earliest')).toBe('1794085200');
    expect(url.searchParams.get('latest')).toBe('1794173039');
    vi.useRealTimers();
  });
  it('does not silently open a legacy relative-time reference', () => {
    expect(() => searchUrl({ ...base, earliest: '-24h', latest: 'now' }, '/en-US')).toThrow(/fixed|absolute/i);
  });
  it('replays a saved report snapshot as SPL with its fixed bounds', () => {
    const url = new URL(searchUrl({ ...base, kind: 'saved', savedName: 'My report', savedOwner: 'nobody' }, '/en-US'), 'https://example.com');
    expect(url.pathname).toBe('/en-US/app/search/search');
    expect(url.searchParams.get('q')).toBe(base.query);
    expect(url.searchParams.get('earliest')).toBe(base.earliest);
  });
  it('blocks SPL time modifiers that would override its frozen window', () => {
    expect(containsTimeModifiers('index=foo earliest=-24h | stats count')).toBe(true);
    expect(containsTimeModifiers('index=foo [ search index=bar latest=now ]')).toBe(true);
    expect(containsTimeModifiers('index=foo | eval label="earliest=not-a-modifier"')).toBe(false);
    expect(containsTimeModifiers('| savedsearch "My report"')).toBe(true);
    expect(containsTimeModifiers('| loadjob savedsearch=admin:search:report')).toBe(true);
    expect(containsTimeModifiers('index=main | where _time > relative_time(now(), "-1h")')).toBe(true);
    expect(containsTimeModifiers('index=main | eval label="now()"')).toBe(false);
    expect(() => searchUrl({ ...base, query: 'index=foo earliest=-24h' }, '/en-US')).toThrow(/time modifier/i);
  });
  it('rejects invalid or reversed absolute windows', () => {
    expect(() => fixedTimeRange('1794173039', '1794085200')).toThrow(/earliest|range/i);
    expect(() => fixedTimeRange('not a timestamp', '1794173039')).toThrow(/absolute|time/i);
    expect(() => fixedTimeRange('2026-02-30T12:00:00Z', '2026-03-31T12:00:00Z')).toThrow(/invalid/i);
  });
});

describe('Splunk time and search-job capture', () => {
  it('resolves both relative bounds in one timeparser call using Splunk timezone rules', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async (input) => {
      calls++;
      const url = new URL(String(input), 'https://splunk.example');
      expect(url.pathname).toBe('/en-US/splunkd/__raw/services/search/timeparser');
      expect(url.searchParams.getAll('time')).toEqual(['-24h@h', 'now']);
      return Response.json({ '-24h@h': '2026-11-08T08:00:00.000+11:00', 'now': '2026-11-09T08:23:59.000+11:00' });
    };
    const result = await createSplunkClient({ prefix: '/en-US', fetcher }).resolveTimeRange('-24h@h', 'now');
    expect(result.earliest).toBe('1794085200');
    expect(result.latest).toBe('1794173039');
    expect(calls).toBe(1);
  });
  it('captures the original query and effective epoch bounds of a completed job', async () => {
    const fetcher: typeof fetch = async () => Response.json({ entry: [{ content: { isDone: true, isFailed: false, isRealTimeSearch: false, dispatchState: 'DONE', searchEarliestTime: 1794085200, searchLatestTime: 1794173039, request: { search: base.query, ui_dispatch_app: 'search' } } }] });
    const result = await createSplunkClient({ prefix: '/en-US', fetcher }).loadSearchJob('123.456');
    expect(result).toMatchObject({ query: base.query, earliest: '1794085200', latest: '1794173039', app: 'search', sourceJobId: '123.456' });
  });
  it('rejects expired jobs without inventing a historical time range', async () => {
    const client = createSplunkClient({ prefix: '/en-US', fetcher: async () => new Response('', { status: 404 }) });
    await expect(client.loadSearchJob('expired')).rejects.toThrow(/expired|not found/i);
  });
});

it('extracts a job ID only from a same-origin Splunk URL', async () => {
  const { searchJobId } = await import('../src/searchTime');
  expect(searchJobId('https://splunk.example/en-US/app/search/search?q=test&sid=123.456', 'https://splunk.example')).toBe('123.456');
  expect(() => searchJobId('https://other.example/en-US/app/search/search?sid=123.456', 'https://splunk.example')).toThrow(/this Splunk server/i);
  expect(() => searchJobId('https://splunk.example/en-US/app/search/search?q=test', 'https://splunk.example')).toThrow(/no search job ID/i);
});
it('does not freeze a running, failed, realtime, or unbounded search job', async () => {
  const wrap = (content: object) => Response.json({ entry: [{ content }] });
  const make = (content: object) => createSplunkClient({ prefix: '/en-US', fetcher: async () => wrap(content) });
  const job = { isDone: true, isFailed: false, isRealTimeSearch: false, searchEarliestTime: 1794085200, searchLatestTime: 1794173039, request: { search: 'index=main' } };
  await expect(make({ ...job, isDone: false }).loadSearchJob('123')).rejects.toThrow(/completed/i);
  await expect(make({ ...job, isFailed: '1' }).loadSearchJob('123')).rejects.toThrow(/successful/i);
  await expect(make({ ...job, isRealTimeSearch: '1' }).loadSearchJob('123')).rejects.toThrow(/historical/i);
  await expect(make({ ...job, searchLatestTime: undefined }).loadSearchJob('123')).rejects.toThrow(/bounds/i);
  await expect(make({ ...job, request: { ...job.request, index_earliest: '-1h' } }).loadSearchJob('123')).rejects.toThrow(/index.time/i);
});
it('captures a saved report definition in its requested namespace', async () => {
  const fetcher: typeof fetch = async input => {
    expect(String(input)).toContain('/servicesNS/nobody/security/saved/searches/Auth%20failures?output_mode=json');
    return Response.json({ entry: [{ content: { search: 'index=auth | stats count' } }] });
  };
  expect(await createSplunkClient({ prefix: '/en-US', fetcher }).loadSavedSearch('security', 'nobody', 'Auth failures')).toBe('index=auth | stats count');
  await expect(createSplunkClient({ prefix: '/en-US', fetcher }).loadSavedSearch('security', '..', 'Auth failures')).rejects.toThrow(/valid/i);
});

it('labels Splunk earliest=0 as all available time rather than a 1970 cutoff', async () => {
  const { describeFixedRange } = await import('../src/searchTime');
  expect(describeFixedRange('0', '1794173039')).toBe('All available time to 2026-11-08T21:23:59.000Z (UTC)');
  const url = new URL(searchUrl({ ...base, earliest: '0' }, '/en-US'), 'https://example.com');
  expect(url.searchParams.get('earliest')).toBe('0');
});

it('refuses a saved report with separate index-time boundaries', async () => {
  const client = createSplunkClient({ prefix: '/en-US', fetcher: async () => Response.json({ entry: [{ content: { search: 'index=main', 'dispatch.index_earliest': '-1d' } }] }) });
  await expect(client.loadSavedSearch('search', 'nobody', 'test')).rejects.toThrow(/index.time/i);
});
