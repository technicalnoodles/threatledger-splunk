import { describe, expect, it, vi } from 'vitest';
import { createSplunkClient } from '../src/splunk';

describe('Enterprise Security record import', () => {
  it('looks up an ES display ID through the public investigations API and prepopulates selected fields', async () => {
    const fetcher: typeof fetch = async input => {
      const url = new URL(String(input), 'https://splunk.example');
      expect(url.pathname).toBe('/en-US/splunkd/__raw/servicesNS/nobody/missioncontrol/public/v2/investigations');
      expect(url.searchParams.get('ids')).toBe('ES-00123');
      return Response.json([{ investigation_id: 'ES-00123', investigation_guid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', queue_id: '__system_default_queue__', name: 'Suspicious activity', description: 'Evidence summary', is_investigation: true, status_name: 'In Progress', urgency: 'high', risk_object: 'host-a', risk_score: 42, _raw: 'do not copy this event body' }]);
    };
    const result = await createSplunkClient({ prefix: '/en-US', fetcher }).loadEsRecord('ES-00123');
    expect(result).toMatchObject({ title: 'Suspicious activity', sourceId: 'ES-00123', esSourceType: 'investigation' });
    expect(result.description).toContain('Evidence summary');
    expect(result.description).toContain('Urgency: high');
    expect(result.description).toContain('Entity: host-a');
    expect(result.description).not.toContain('do not copy this event body');
    const link = new URL(result.sourceUrl, 'https://splunk.example');
    expect(link.pathname).toBe('/en-US/app/SplunkEnterpriseSecuritySuite/mission_control');
    expect(link.searchParams.get('ticketId')).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  });
  it('uses the exact finding event_id and a bounded time hint for an individual finding', async () => {
    const id = '12345678-abcd-4cde-8f01-23456789abcd@@notable@@time1794173039';
    const fetcher: typeof fetch = async input => {
      const url = new URL(String(input), 'https://splunk.example');
      expect(decodeURIComponent(url.pathname)).toContain(`/public/v2/findings/${id}`);
      expect(url.searchParams.get('earliest')).toBe('1794172739');
      return Response.json({ event_id: id, rule_title: 'Login anomaly', rule_description: 'Unusual sign in', status_label: 'New', urgency: 'medium', _time: '1794173039' });
    };
    const result = await createSplunkClient({ prefix: '/en-US', fetcher }).loadEsRecord(id);
    expect(result).toMatchObject({ title: 'Login anomaly', sourceId: id, esSourceType: 'finding' });
    expect(result.description).toContain('Unusual sign in');
    expect(result.description).toContain('Status: New');
    expect(result.description).toContain('Event time: 2026-11-08T21:23:59.000Z');
  });
  it('does not import a different record or treat missing access as a match', async () => {
    const mismatch = createSplunkClient({ prefix: '/en-US', fetcher: async () => Response.json([{ investigation_id: 'ES-00999', name: 'Wrong record' }]) });
    await expect(mismatch.loadEsRecord('ES-00123')).rejects.toThrow(/not found|match/i);
    const denied = createSplunkClient({ prefix: '/en-US', fetcher: async () => new Response('', { status: 403 }) });
    await expect(denied.loadEsRecord('ES-00123')).rejects.toThrow(/403/);
    const fetcher = vi.fn();
    await expect(createSplunkClient({ prefix: '/en-US', fetcher }).loadEsRecord('../private')).rejects.toThrow(/ID/i);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it('resolves an unpadded ES ID using the displayed five-digit form when needed', async () => {
  const requested: string[] = [];
  const fetcher: typeof fetch = async input => {
    const id = new URL(String(input), 'https://splunk.example').searchParams.get('ids')!;
    requested.push(id);
    return Response.json(id === 'ES-00123' ? [{ investigation_id: id, name: 'Example', is_investigation: true }] : []);
  };
  const result = await createSplunkClient({ prefix: '/en-US', fetcher }).loadEsRecord('ES-123');
  expect(requested).toEqual(['ES-123', 'ES-00123']);
  expect(result.sourceId).toBe('ES-00123');
});

it('does not label a record as a finding when ES does not identify its type', async () => {
  const client = createSplunkClient({ prefix: '/en-US', fetcher: async () => Response.json([{ investigation_id: 'ES-00123', name: 'Example' }]) });
  const result = await client.loadEsRecord('ES-00123');
  expect(result.esSourceType).toBe('record');
  expect(result.description).toContain('Record type: ES record');
});
