// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ReferencesEditor } from '../src/components/References';
import { readFileSync } from 'node:fs';
const css = readFileSync('src/references.css', 'utf8');

afterEach(() => { cleanup(); document.head.innerHTML = ''; });
it('keeps reference text and form fields legible inside a light Splunk host', () => {
  const host = document.createElement('style');
  host.textContent = '#root h2, #root h3, #root strong, #root p { color: #333333; } #root textarea { background: white; color: #222222; }';
  document.head.append(host);
  const styles = document.createElement('style'); styles.textContent = css; document.head.append(styles);
  const container = document.createElement('div'); container.id = 'root'; document.body.append(container);
  render(<ReferencesEditor references={{ findings: [{ id: 'f', title: 'Example finding', description: 'Example notes', sourceId: 'EXAMPLE', sourceUrl: '' }], searches: [] }} onChange={() => {}} prefix="/en-US"/>, { container });
  expect(getComputedStyle(screen.getByRole('heading', { name: 'Findings' })).color).toBe('rgb(231, 237, 245)');
  expect(getComputedStyle(screen.getByText('Example finding', { selector: 'strong' })).color).toBe('rgb(231, 237, 245)');
  expect(getComputedStyle(screen.getByLabelText('Finding notes')).backgroundColor).toBe('rgb(11, 17, 24)');
  container.remove();
});
