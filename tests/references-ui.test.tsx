// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ReferencesEditor } from '../src/components/References';
import type { References } from '../src/report';

afterEach(cleanup);
it('adds a finding and links a search without running it', async () => {
  function Harness() {
    const [refs, setRefs] = useState<References>({ findings: [], searches: [] });
    return <ReferencesEditor references={refs} onChange={setRefs} prefix="/en-US"/>;
  }
  const user = userEvent.setup();
  render(<Harness/>);
  await user.type(screen.getByLabelText('Finding title'), 'Unusual execution');
  await user.type(screen.getByLabelText('Finding ID'), 'ES-123');
  await user.click(screen.getByRole('button', { name: 'Add finding' }));
  expect(screen.getByText('Unusual execution', { selector: 'strong' })).toBeVisible();
  await user.type(screen.getByLabelText('Search title'), 'Process events');
  await user.type(screen.getByLabelText('Search SPL'), 'index=main | head 5');
  await user.selectOptions(screen.getByLabelText('Linked finding'), screen.getByRole('option', { name: 'Unusual execution' }));
  await user.click(screen.getByRole('button', { name: 'Add search' }));
  expect(screen.getByRole('link', { name: 'Open search: Process events' })).toHaveAttribute('href', expect.stringContaining('index%3Dmain'));
  expect(screen.getByText(/Linked finding: Unusual execution/)).toBeVisible();
});

it('records a fixed time range when adding a relative search', async () => {
  const { vi } = await import('vitest');
  const resolveTimeRange = vi.fn().mockResolvedValue({ earliest: '1794085200', latest: '1794173039', capturedAt: '2026-11-08T21:23:59.000Z' });
  let saved: References | undefined;
  const client = { resolveTimeRange, loadSearchJob: vi.fn(), loadSavedSearch: vi.fn() };
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [] }} onChange={v => { saved = v; }} prefix="/en-US" client={client}/>);
  await user.type(screen.getByLabelText('Search title'), 'Historical search');
  await user.type(screen.getByLabelText('Search SPL'), 'index=main | stats count');
  await user.click(screen.getByRole('button', { name: 'Add search' }));
  expect(resolveTimeRange).toHaveBeenCalledWith('-24h', 'now');
  expect(saved?.searches[0]).toMatchObject({ earliest: '1794085200', latest: '1794173039', timeSource: 'captured' });
});

it('imports a completed job without replacing its original time range with the current time', async () => {
  const { vi } = await import('vitest');
  const resolveTimeRange = vi.fn();
  const client = { resolveTimeRange, loadSearchJob: vi.fn().mockResolvedValue({ query: 'index=main | stats count', earliest: '1794085200', latest: '1794173039', app: 'search', sourceJobId: '123.456' }), loadSavedSearch: vi.fn() };
  let saved: References | undefined;
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [] }} onChange={v => { saved = v; }} prefix="/en-US" client={client}/>);
  await user.type(screen.getByLabelText('Search job link or ID'), '123.456');
  await user.click(screen.getByRole('button', { name: 'Import search job' }));
  expect(await screen.findByDisplayValue('1794085200')).toBeVisible();
  await user.type(screen.getByLabelText('Search title'), 'Past investigation');
  await user.click(screen.getByRole('button', { name: 'Add search' }));
  expect(saved?.searches[0]).toMatchObject({ earliest: '1794085200', latest: '1794173039', sourceJobId: '123.456', timeSource: 'job' });
  expect(resolveTimeRange).not.toHaveBeenCalled();
});

it('does not turn a legacy relative range into a misleading historical window on edit', async () => {
  const { vi } = await import('vitest');
  const ref = { id: 'old', title: 'Old search', kind: 'adhoc' as const, query: 'index=main', earliest: '-24h', latest: 'now', app: 'search', note: '' };
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [ref] }} onChange={onChange} prefix="/en-US"/>);
  expect(screen.getByText(/original.*time.*not.*saved/i)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Edit search: Old search' }));
  await user.click(screen.getByRole('button', { name: 'Update search' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/original.*absolute|job/i);
  expect(onChange).not.toHaveBeenCalled();
});

it('captures saved report SPL and fixed time instead of linking to its moving definition', async () => {
  const { vi } = await import('vitest');
  const client = { resolveTimeRange: vi.fn().mockResolvedValue({ earliest: '1794085200', latest: '1794173039', capturedAt: '2026-11-08T21:23:59.000Z' }), loadSearchJob: vi.fn(), loadSavedSearch: vi.fn().mockResolvedValue('index=auth | stats count') };
  let saved: References | undefined;
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [] }} onChange={v => { saved = v; }} prefix="/en-US" client={client}/>);
  await user.type(screen.getByLabelText('Search title'), 'Auth report');
  await user.selectOptions(screen.getByLabelText('Search type'), 'saved');
  expect(screen.getByLabelText('Earliest')).toHaveValue('');
  expect(screen.getByLabelText('Latest')).toHaveValue('');
  await user.type(screen.getByLabelText('Earliest'), '-24h');
  await user.type(screen.getByLabelText('Latest'), 'now');
  await user.type(screen.getByLabelText('Saved report name'), 'Auth failures');
  await user.type(screen.getByLabelText('Saved report owner'), 'nobody');
  await user.click(screen.getByRole('button', { name: 'Add search' }));
  expect(client.loadSavedSearch).toHaveBeenCalledWith('search', 'nobody', 'Auth failures');
  expect(saved?.searches[0]).toMatchObject({ kind: 'saved', query: 'index=auth | stats count', earliest: '1794085200', latest: '1794173039' });
});

it('preserves findings added while Splunk resolves a search time', async () => {
  const { vi } = await import('vitest');
  const { act, waitFor } = await import('@testing-library/react');
  let finish!: (value: { earliest: string; latest: string; capturedAt: string }) => void;
  const pending = new Promise<{ earliest: string; latest: string; capturedAt: string }>(resolve => { finish = resolve; });
  const client = { resolveTimeRange: vi.fn().mockReturnValue(pending), loadSearchJob: vi.fn(), loadSavedSearch: vi.fn() };
  function Harness() {
    const [refs, setRefs] = useState<References>({ findings: [], searches: [] });
    return <ReferencesEditor references={refs} onChange={setRefs} prefix="/en-US" client={client}/>;
  }
  const user = userEvent.setup(); render(<Harness/>);
  await user.type(screen.getByLabelText('Search title'), 'Concurrent search');
  await user.type(screen.getByLabelText('Search SPL'), 'index=main');
  await user.click(screen.getByRole('button', { name: 'Add search' }));
  await user.type(screen.getByLabelText('Finding title'), 'Concurrent finding');
  await user.click(screen.getByRole('button', { name: 'Add finding' }));
  await act(async () => finish({ earliest: '1794085200', latest: '1794173039', capturedAt: '2026-11-08T21:23:59.000Z' }));
  await waitFor(() => expect(screen.getByRole('link', { name: 'Open search: Concurrent search' })).toBeVisible());
  expect(screen.getByText('Concurrent finding', { selector: 'strong' })).toBeVisible();
});

it('accepts an explicitly absolute range without relying on the time parser', async () => {
  const { vi } = await import('vitest');
  const client = { resolveTimeRange: vi.fn().mockRejectedValue(new Error('unavailable')), loadSearchJob: vi.fn(), loadSavedSearch: vi.fn() };
  let saved: References | undefined;
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [] }} onChange={v => { saved = v; }} prefix="/en-US" client={client}/>);
  await user.type(screen.getByLabelText('Search title'), 'Absolute search');
  await user.type(screen.getByLabelText('Search SPL'), 'index=main');
  await user.clear(screen.getByLabelText('Earliest'));
  await user.type(screen.getByLabelText('Earliest'), '2026-11-07T21:00:00Z');
  await user.clear(screen.getByLabelText('Latest'));
  await user.type(screen.getByLabelText('Latest'), '2026-11-08T21:23:59Z');
  await user.click(screen.getByRole('button', { name: 'Add search' }));
  expect(saved?.searches[0]).toMatchObject({ earliest: '1794085200', latest: '1794173039' });
  expect(client.resolveTimeRange).not.toHaveBeenCalled();
});

it('prefills an ES record by ID for review without adding it automatically', async () => {
  const { vi } = await import('vitest');
  const onChange = vi.fn();
  const client = { resolveTimeRange: vi.fn(), loadSearchJob: vi.fn(), loadSavedSearch: vi.fn(), loadEsRecord: vi.fn().mockResolvedValue({ title: 'Suspicious activity', sourceId: 'ES-00123', sourceUrl: '/en-US/app/SplunkEnterpriseSecuritySuite/mission_control?ticketId=test', description: 'Review this evidence\n\nUrgency: high', esSourceType: 'investigation', esImportedAt: '2026-11-08T22:00:00.000Z' }) };
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [] }} onChange={onChange} prefix="/en-US" client={client}/>);
  await user.type(screen.getByLabelText('Finding ID'), 'ES-00123');
  await user.click(screen.getByRole('button', { name: 'Load from ES' }));
  expect(await screen.findByDisplayValue('Suspicious activity')).toBeVisible();
  expect(screen.getByLabelText('Finding notes')).toHaveValue('Review this evidence\n\nUrgency: high');
  expect(screen.getByText(/ES investigation.*review/i)).toBeVisible();
  expect(onChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Add finding' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ findings: [expect.objectContaining({ sourceId: 'ES-00123', esSourceType: 'investigation' })] }));
});

it('preserves existing draft text when loading details from ES', async () => {
  const { vi } = await import('vitest');
  const client = { resolveTimeRange: vi.fn(), loadSearchJob: vi.fn(), loadSavedSearch: vi.fn(), loadEsRecord: vi.fn().mockResolvedValue({ title: 'From ES', sourceId: 'ES-00123', sourceUrl: '', description: 'From ES notes', esSourceType: 'finding', esImportedAt: '2026-11-08T22:00:00.000Z' }) };
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [] }} onChange={vi.fn()} prefix="/en-US" client={client}/>);
  await user.type(screen.getByLabelText('Finding title'), 'My draft');
  await user.type(screen.getByLabelText('Finding notes'), 'Keep this');
  await user.type(screen.getByLabelText('Finding ID'), 'ES-00123');
  await user.click(screen.getByRole('button', { name: 'Load from ES' }));
  expect(await screen.findByText(/existing.*kept/i)).toBeVisible();
  expect(screen.getByLabelText('Finding title')).toHaveValue('My draft');
  expect(screen.getByLabelText('Finding notes')).toHaveValue('Keep this');
});

it('keeps the entered ID and draft when ES access is denied', async () => {
  const { vi } = await import('vitest');
  const client = { resolveTimeRange: vi.fn(), loadSearchJob: vi.fn(), loadSavedSearch: vi.fn(), loadEsRecord: vi.fn().mockRejectedValue(new Error('Splunk request failed (403). Check your access.')) };
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [] }} onChange={vi.fn()} prefix="/en-US" client={client}/>);
  await user.type(screen.getByLabelText('Finding ID'), 'ES-00123');
  await user.click(screen.getByRole('button', { name: 'Load from ES' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('403');
  expect(screen.getByLabelText('Finding ID')).toHaveValue('ES-00123');
  expect(screen.getByLabelText('Finding title')).toHaveValue('');
});

it('warns when the ID changes after an ES record was loaded', async () => {
  const { vi } = await import('vitest');
  const onChange = vi.fn();
  const client = { resolveTimeRange: vi.fn(), loadSearchJob: vi.fn(), loadSavedSearch: vi.fn(), loadEsRecord: vi.fn().mockResolvedValue({ title: 'From ES', sourceId: 'ES-00123', sourceUrl: '/en-US/app/SplunkEnterpriseSecuritySuite/mission_control?ticketId=test', description: 'Evidence', esSourceType: 'investigation', esImportedAt: '2026-11-08T22:00:00.000Z' }) };
  const user = userEvent.setup();
  render(<ReferencesEditor references={{ findings: [], searches: [] }} onChange={onChange} prefix="/en-US" client={client}/>);
  await user.type(screen.getByLabelText('Finding ID'), 'ES-00123');
  await user.click(screen.getByRole('button', { name: 'Load from ES' }));
  await screen.findByDisplayValue('From ES');
  await user.clear(screen.getByLabelText('Finding ID'));
  await user.type(screen.getByLabelText('Finding ID'), 'ES-00222');
  expect(screen.getByText(/ID changed.*earlier ES record/i)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Add finding' }));
  expect(onChange.mock.calls[0][0].findings[0].esSourceType).toBeUndefined();
});
