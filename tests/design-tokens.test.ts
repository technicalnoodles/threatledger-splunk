import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokenFile = 'src/design-system/tokens.css';
function token(css: string, name: string): string {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)?.[1];
  if (!value) throw new Error(`Missing color token --${name}`);
  return value;
}
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
describe('brand design tokens', () => {
  it('uses the current gradient endpoints and a neutral primary action', () => {
    const css = readFileSync(tokenFile, 'utf8');
    expect(token(css, 'brand-magenta-50')).toBe('#FF007F');
    expect(token(css, 'brand-orange-50')).toBe('#FF9000');
    expect(token(css, 'action-primary')).toBe('#FFFFFF');
    expect(css).toMatch(/--brand-gradient:\s*linear-gradient\(90deg,\s*var\(--brand-magenta-50\),\s*var\(--brand-orange-50\)\)/);
  });
  it('maintains readable foreground, muted text, links and primary actions', () => {
    const css = readFileSync(tokenFile, 'utf8');
    for (const [foreground, background] of [['text-primary', 'surface-page'], ['text-secondary', 'surface-page'], ['text-primary', 'surface-panel'], ['link-dark', 'surface-page'], ['link-dark', 'surface-panel'], ['link-light', 'white'], ['action-primary-text', 'action-primary']]) {
      expect(contrast(token(css, foreground), token(css, background)), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
