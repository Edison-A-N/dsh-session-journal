/**
 * Client-bundle build for dsh-session-journal: the same closure-factory wire
 * format as other DSH web plugins (window.__ModuleLoader__.load), with react
 * and @deepseek-ai/* kept external. CSS ships as a JS string (styles.js).
 * Absolute source paths are scrubbed from the bundle and its source map.
 */
import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/+$/, '')
const PLUGIN_ID = 'dsh-session-journal'

const result = await build({
  entryPoints: [join(ROOT, 'client/src/index.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  sourcemap: true,
  outfile: join(ROOT, 'lib/client.js'),
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/*'],
  logLevel: 'warning',
  metafile: true,
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`,
  },
  footer: { js: 'return module.exports; } });' },
})

for (const artifact of [join(ROOT, 'lib/client.js'), join(ROOT, 'lib/client.js.map')]) {
  const text = await readFile(artifact, 'utf8')
  const scrubbed = text.split(ROOT + '/').join('')
  if (scrubbed !== text) await writeFile(artifact, scrubbed)
}
console.log(`client bundle: lib/client.js (${Object.keys(result.metafile.inputs).length} inputs)`)
