import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Splunk app definition', () => {
  it('provides matching launcher and web static icons at Splunk sizes', () => {
    const root = 'splunk-app/threatledger';
    for (const [name, size] of [['appIcon.png', 36], ['appIcon_2x.png', 72], ['appIconAlt.png', 36], ['appIconAlt_2x.png', 72]] as const) {
      const icon = readFileSync(`${root}/static/${name}`);
      expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([size, size]);
      expect(readFileSync(`${root}/appserver/static/${name}`)).toEqual(icon);
    }
  });
  it('exposes the report collection through an explicitly shared lookup', () => {
    const root = 'splunk-app/threatledger';
    const collection = readFileSync(`${root}/default/collections.conf`, 'utf8');
    const lookup = readFileSync(`${root}/default/transforms.conf`, 'utf8');
    const permissions = readFileSync(`${root}/metadata/default.meta`, 'utf8');
    expect(collection).toContain('[reports]');
    expect(lookup).toMatch(/collection\s*=\s*reports/);
    expect(lookup).toContain('report_id');
    expect(permissions).toContain('[collections/reports]');
    expect(permissions).toContain('[transforms/threatledger_reports]');
  });
  it('mounts the editor from a Splunk view and gives it an app navigation entry', () => {
    const root = 'splunk-app/threatledger/default/data/ui';
    const version = JSON.parse(readFileSync('splunk-app/threatledger/app.manifest', 'utf8')).info.id.version;
    expect(readFileSync(`${root}/views/threatledger.xml`, 'utf8')).toContain(`script="bootstrap-${version}.js"`);
    expect(readFileSync(`${root}/views/threatledger.xml`, 'utf8')).toContain('id="root"');
    expect(readFileSync(`${root}/nav/default.xml`, 'utf8')).toContain('name="threatledger"');
  });
});

it('keeps the Splunk manifest, app configuration, and npm metadata on the same newer version', () => {
  const manifest = JSON.parse(readFileSync('splunk-app/threatledger/app.manifest', 'utf8'));
  const conf = readFileSync('splunk-app/threatledger/default/app.conf', 'utf8');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const version = manifest.info.id.version;
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  const [major, minor, patch] = version.split('.').map(Number);
  expect(major > 0 || minor > 2 || (minor === 2 && patch > 3)).toBe(true);
  expect(manifest.info.id.name).toBe('threatledger');
  expect(manifest.supportedDeployments).toContain('_search_head_clustering');
  expect(manifest.targetWorkloads).toEqual(['_search_heads']);
  expect(conf.match(/^version\s*=\s*(\S+)/gm)).toEqual([`version = ${version}`, `version = ${version}`]);
  expect(pkg.version).toBe(version);
  expect(lock.version).toBe(version);
  expect(lock.packages[''].version).toBe(version);
});
