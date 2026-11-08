// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installSplunkLayout } from '../src/splunkLayout';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('embedded Splunk layout', () => {
  it('keeps the app sized to the visible area below Splunk navigation and updates on resize', () => {
    document.body.innerHTML = '<main class="dashboard-body"><div id="threatledger-host"><div id="root"></div></div></main>';
    const root = document.querySelector<HTMLElement>('#root')!;
    let top = 56;
    vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => ({ top } as DOMRect));
    const cleanup = installSplunkLayout(root);
    expect(root.style.getPropertyValue('--threatledger-top-offset')).toBe('56px');
    top = 92;
    window.dispatchEvent(new Event('resize'));
    expect(root.style.getPropertyValue('--threatledger-top-offset')).toBe('92px');
    cleanup();
  });
  it('loads the scoped dashboard stylesheet only for the ThreatLedger view', () => {
    const xml = readFileSync('splunk-app/threatledger/default/data/ui/views/threatledger.xml', 'utf8');
    const version = JSON.parse(readFileSync('splunk-app/threatledger/app.manifest', 'utf8')).info.id.version;
    const css = readFileSync(`splunk-app/threatledger/appserver/static/splunk-layout-${version}.css`, 'utf8');
    expect(xml).toContain(`stylesheet="splunk-layout-${version}.css"`);
    expect(xml).toContain('id="threatledger-host"');
    expect(css).toContain('.dashboard-body:has(#threatledger-host)');
    expect(css).toContain('var(--threatledger-top-offset');
  });
  it('hides the Splunk app rail only in the main area containing ThreatLedger', () => {
    document.body.innerHTML = '<div role="main"><div data-view="views/shared/appbar/Master" id="rail"></div><div id="threatledger-host"><div id="root"></div></div></div><div role="main"><div data-view="views/shared/appbar/Master" id="other-rail"></div></div>';
    const version = JSON.parse(readFileSync('splunk-app/threatledger/app.manifest', 'utf8')).info.id.version;
    const css = readFileSync(`splunk-app/threatledger/appserver/static/splunk-layout-${version}.css`, 'utf8');
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    expect(getComputedStyle(document.querySelector('#rail')!).display).toBe('none');
    expect(getComputedStyle(document.querySelector('#other-rail')!).display).not.toBe('none');
    style.remove();
  });
});
