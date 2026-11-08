// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/main';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), clear: () => values.clear() });
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('report authoring interface', () => {
  it('distinguishes untitled reports and exposes the current report', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Campaign Report/i }));
    await user.click(screen.getAllByRole('button', { name: 'New report' })[0]);
    await user.click(screen.getByRole('button', { name: /Executive Report/i }));
    const campaign = screen.getByRole('button', { name: 'Untitled 1 · Campaign Report' });
    const executive = screen.getByRole('button', { name: 'Untitled 2 · Executive Report' });
    expect(executive).toHaveAttribute('aria-current', 'true');
    expect(campaign).not.toHaveAttribute('aria-current');
    await user.click(campaign);
    expect(campaign).toHaveAttribute('aria-current', 'true');
    expect(executive).not.toHaveAttribute('aria-current');
  });

  it('identifies which structured entry each action affects', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Campaign Report/i }));
    await user.click(screen.getByRole('button', { name: /MITRE ATT&CK/i }));
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(screen.getByRole('button', { name: 'Delete entry 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete entry 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Move up entry 2' })).toBeEnabled();
  });
  it('preserves unreadable recovery data and pauses browser recovery', async () => {
    const original = '{not-valid-json';
    localStorage.setItem('cti-workbench-recovery-v1', original);
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/recovery.*paused/i);
    expect(screen.getByRole('button', { name: /download recovery data/i })).toBeVisible();
    expect(localStorage.getItem('cti-workbench-recovery-v1')).toBe(original);
    await userEvent.setup().click(screen.getByRole('button', { name: /Campaign Report/i }));
    expect(localStorage.getItem('cti-workbench-recovery-v1')).toBe(original);
  });

  it('retains readable reports without overwriting mixed valid and invalid recovery records', async () => {
    const { createReport, templates } = await import('../src/report');
    const report = createReport(templates[0].id, { report_title: 'Recoverable report' });
    const original = JSON.stringify([report, { invalid: true }]);
    localStorage.setItem('cti-workbench-recovery-v1', original);
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/recovery.*paused/i);
    expect(screen.getByDisplayValue('Recoverable report')).toBeVisible();
    expect(localStorage.getItem('cti-workbench-recovery-v1')).toBe(original);
  });

  it('shows a persistent recovery failure when storage writes fail', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Campaign Report/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/browser recovery.*unavailable/i);
    expect(screen.queryByText('Stored locally')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download workspace/i })).toBeVisible();
  });

  it('does not write anything when browser recovery cannot be read', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const write = vi.spyOn(localStorage, 'setItem');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/browser recovery.*unavailable/i);
    expect(write).not.toHaveBeenCalled();
  });

  it('starts a campaign report and stores the report title', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Campaign Report/i }));
    const title = screen.getByLabelText('Report Title');
    await user.type(title, 'Operation Example');
    await waitFor(() => expect(localStorage.getItem('cti-workbench-recovery-v1')).toContain('Operation Example'));
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute('data-slot', 'button');
  });

  it('uses an accessible export dialog with selectable sections and Escape dismissal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Executive Report/i }));
    const exportButton = screen.getByRole('button', { name: 'Export' });
    await user.click(exportButton);
    const dialog = screen.getByRole('dialog', { name: 'Export report' });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveTextContent(/Word.*Markdown/i);
    expect(dialog).toHaveTextContent(/PDF.*font/i);
    expect(dialog).toHaveTextContent(/review.*download/i);
    const summary = screen.getByRole('checkbox', { name: 'Executive Summary' });
    expect(summary).toBeChecked();
    await user.click(summary);
    expect(summary).not.toBeChecked();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(exportButton).toHaveFocus();
  });

  it('provides report-specific writing guidance', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Executive Report/i }));
    await user.click(screen.getByRole('button', { name: /Executive Summary/i }));
    expect(screen.getByText(/risk to decision.makers/i)).toBeVisible();
    expect(screen.getByText(/Decision requested: \[action\]/i)).toBeVisible();
  });

  it('returns keyboard focus to the outline control when the mobile outline closes', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Campaign Report/i }));
    await user.click(screen.getByRole('button', { name: 'Show outline' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hide outline' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Hide outline' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show outline' })).toHaveFocus());
  });

  it('moves keyboard focus to the selected section after mobile navigation', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Campaign Report/i }));
    await user.click(screen.getByRole('button', { name: 'Show outline' }));
    await user.click(screen.getByRole('button', { name: /Executive Summary/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Executive Summary' })).toHaveFocus());
  });

  it('keeps edits typed while an inserted image is still loading', async () => {
    let pending: { result: string; onload?: () => void } | undefined;
    class DeferredReader {
      result = 'data:image/png;base64,aGVsbG8=';
      onload?: () => void;
      onerror?: () => void;
      readAsDataURL() { pending = this; }
    }
    vi.stubGlobal('FileReader', DeferredReader);
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: /Campaign Report/i }));
    await user.click(screen.getByRole('button', { name: /Executive Summary/i }));
    const editor = screen.getByLabelText('Executive Summary');
    await user.type(editor, 'Original');
    const imageInput = container.querySelector('input[accept="image/png,image/jpeg"]') as HTMLInputElement;
    await user.upload(imageInput, new File(['image'], 'evidence.png', { type: 'image/png' }));
    await user.type(editor, ' added later');
    await act(async () => { pending?.onload?.(); });
    expect((editor as HTMLTextAreaElement).value).toContain('Original added later');
    expect((editor as HTMLTextAreaElement).value).toContain('cti-image:');
  });
});
