// Run against a checkout of CTI Blueprints to refresh the derived template data.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '../../work/upstream/src/cti_authoring_tool/src/assets/configuration');
const entries = ['ThreatActorProfile', 'Campaign', 'IntrusionAnalysis', 'Executive'];
const input = entries.map(n => `import { ${n} } from ${JSON.stringify(path.join(root, 'templates', `${n}.ts`))};`).join('\n') + `\nexport default [${entries.join(',')}];`;
const result = await build({
  stdin: { contents: input, resolveDir: root, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'schema-only', setup(b) {
    b.onResolve({ filter: /^@\/assets\/scripts\/PageEditor$/ }, () => ({ path: 'types', namespace: 'stub' }));
    b.onResolve({ filter: /\/plugins\// }, args => ({ path: path.resolve(args.resolveDir, args.path) + '.ts', namespace: 'plugin-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `export const PropertyType={String:0,Integer:1,Float:2,Time:3,Date:4,DateTime:5,Enum:6,BasicTable:7,ComplexTable:8}; export const PluginType={Section:0,StringProperty:1,FloatProperty:2,IntegerProperty:3,EnumProperty:4,DateProperty:5,TimeProperty:6,DateTimeProperty:7,BasicTableProperty:8,ComplexTableProperty:9};` }));
    b.onLoad({ filter: /.*/, namespace: 'plugin-stub' }, async args => {
      const source = await readFile(args.path, 'utf8');
      const names = [...source.matchAll(/export\s+(?:class|const|function)\s+(\w+)/g)].map(x => x[1]);
      return { contents: names.map(name => `export const ${name} = null;`).join('\n') };
    });
  }}]
});
const templates = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default;
await writeFile('src/templates.json', JSON.stringify(templates, null, 2) + '\n');
