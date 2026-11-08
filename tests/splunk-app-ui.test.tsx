// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/main';

beforeEach(() => {
  window.history.replaceState({}, '', '/en-US/app/threatledger/threatledger');
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  document.cookie = 'splunkweb_csrf_token_8000=token; path=/';
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue({ matches: false }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });
it('adds a finding to a report and saves the workspace in Splunk', async () => {
  let saved: any;
  vi.stubGlobal('fetch', vi.fn(async (input, init) => {
    if (init?.method === 'POST') { saved = JSON.parse(String(init.body)); return new Response('{}', { status: 200 }); }
    if (String(input).includes('?limit=0')) return new Response('[]', { status: 200 });
    return new Response('', { status: 404 });
  }));
  const user = userEvent.setup(); render(<App/>);
  await user.click(screen.getByRole('button', { name: /Campaign Report/i }));
  await user.click(screen.getByRole('button', { name: /Findings and searches/i }));
  expect(screen.getByRole('button', { name: /Findings and searches/i })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('button', { name: /^01Campaign Report/i })).not.toHaveAttribute('aria-current');
  await user.type(screen.getByLabelText('Finding title'), 'Suspicious process');
  await user.click(screen.getByRole('button', { name: 'Add finding' }));
  await user.click(screen.getByRole('button', { name: 'Save to Splunk' }));
  await waitFor(() => expect(saved.workspace.references.findings[0].title).toBe('Suspicious process'));
  expect(screen.getByRole('status')).toHaveTextContent(/saved to splunk/i);
});

it('opens a shared report from the catalog and restores its findings', async () => {
  const { createReport, templates } = await import('../src/report');
  const report = createReport(templates[0].id, { report_title: 'Shared investigation' });
  report.references = { findings: [{ id: 'f1', title: 'Linked finding', description: '', sourceId: 'ES-8', sourceUrl: '' }], searches: [] };
  const record = { _key: report.id, report_id: report.id, title: 'Shared investigation', template_id: report.templateId, revision: 'rev1', updated_at: '2026-11-08T00:00:00Z', report_path: '', finding_ids: 'ES-8', workspace: report };
  vi.stubGlobal('fetch', vi.fn(async input => new Response(JSON.stringify(String(input).includes('?limit=0') ? [record] : record), { status: 200 })));
  const user = userEvent.setup(); render(<App/>);
  await user.click(screen.getByRole('button', { name: 'Shared reports' }));
  await user.click(await screen.findByRole('button', { name: /Shared investigation/ }));
  expect(await screen.findByDisplayValue('Shared investigation')).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Findings and searches/ }));
  expect(screen.getByText('Linked finding', { selector: 'strong' })).toBeVisible();
});

it('shows a loading state instead of an empty catalog while reports are being fetched', async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  const user = userEvent.setup(); render(<App/>);
  await user.click(screen.getByRole('button', { name: 'Shared reports' }));
  expect(screen.getByText('Loading shared reports…')).toBeVisible();
  expect(screen.queryByText('No shared reports found.')).not.toBeInTheDocument();
  finish(new Response('[]', { status: 200 }));
  expect(await screen.findByText('No shared reports found.')).toBeVisible();
});
