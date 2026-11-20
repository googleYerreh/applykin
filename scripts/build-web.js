// Builds dist/index.html: one self-contained file (app + PDF reader + DOCX reader), no network needed.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const workerAsText = {
  name: 'worker-as-text',
  setup(b) {
    b.onLoad({ filter: /pdf\.worker\.min\.mjs$/ }, async (args) => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
  },
};

const out = await build({
  entryPoints: ['web/app.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2022',
  charset: 'ascii', // keep non-ASCII as escapes in the inlined script
  plugins: [workerAsText],
  logLevel: 'warning',
});

const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = (await readFile('web/index.html', 'utf8')).replace('/*APP*/', () => js);
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
