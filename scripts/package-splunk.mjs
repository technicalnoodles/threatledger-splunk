import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const entry = manifest['index.html'];
if (!entry?.file || !entry.css?.length) throw new Error('Vite app assets missing from manifest.');
const cssFiles = new Set();
const visited = new Set();
function collectCss(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const item = manifest[key];
  if (!item) throw new Error(`Missing manifest entry: ${key}`);
  for (const dependency of item.imports || []) collectCss(dependency);
  for (const css of item.css || []) cssFiles.add(css);
}
collectCss('index.html');
const staging = path.resolve('build/splunk');
const app = path.join(staging, 'threatledger');
await rm(staging, { recursive: true, force: true });
await cp('splunk-app/threatledger', app, { recursive: true });
const version = JSON.parse(await readFile(path.join(app, 'app.manifest'), 'utf8')).info.id.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid app version for bootstrap filename.');
const bootstrapName = `bootstrap-${version}.js`;
const view = await readFile(path.join(app, 'default/data/ui/views/threatledger.xml'), 'utf8');
if (!view.includes(`script="${bootstrapName}"`)) throw new Error('Dashboard bootstrap filename does not match the app version.');
const staticDir = path.join(app, 'appserver/static');
await mkdir(staticDir, { recursive: true });
await cp('dist/assets', path.join(staticDir, 'assets'), { recursive: true });
const bootstrap = `require(['splunkjs/mvc/simplexml/ready!'], function () {\n  var marker = '/app/threatledger/';\n  var index = window.location.pathname.indexOf(marker);\n  if (index < 0) { document.getElementById('root').textContent = 'Unable to determine the Splunk app path.'; return; }\n  var base = window.location.pathname.slice(0, index) + '/static/app/threatledger/';\n  ${[...cssFiles].map(css => `var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + ${JSON.stringify(css)}; document.head.appendChild(css);`).join('\n  ')}\n  import(base + ${JSON.stringify(entry.file)}).catch(function () { document.getElementById('root').textContent = 'Unable to load ThreatLedger. Check app assets and browser console.'; });\n});\n`;
await writeFile(path.join(staticDir, bootstrapName), bootstrap);
for (const name of ['LICENSE', 'LICENSE-Inter.txt', 'LICENSE-Liberation.txt', 'LICENSE-shadcn-ui.txt']) await cp(name, path.join(app, name));
await mkdir('outputs', { recursive: true });
execFileSync('tar', ['-czf', path.resolve('outputs/threatledger.spl'), '-C', staging, 'threatledger'], { stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } });
console.log('Created outputs/threatledger.spl');
