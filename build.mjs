import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('.', import.meta.url).pathname;
const out = `${root}/dist`;
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
  entryPoints: [`${root}/src/app.js`],
  outfile: `${out}/app.js`,
  bundle: true,
  format: 'iife',
  target: ['chrome114'],
  sourcemap: false,
  legalComments: 'none'
});
for (const file of ['manifest.json', 'index.html', 'popup.html', 'popup.js', 'styles.css']) {
  await cp(`${root}/${file}`, `${out}/${file}`);
}
console.log('Build OK: dist/ (código autocontenido; sin scripts remotos).');
