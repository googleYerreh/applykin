// Builds dist/index.html: one self-contained file (app + PDF reader + DOCX reader), no network needed.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const workerAsText = {
  name: 'worker-as-text',
  setup(b) {
    b.onLoad({ filter: /pdf\.worker\.min\.mjs$/ }, async (args) => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
  },
};

// The ranking worker is bundled separately and inlined as text, then started from a Blob,
// so the page stays a single file.
const worker = await build({
  entryPoints: ['web/rank-worker.js'], bundle: true, format: 'iife', minify: true, write: false,
  target: 'es2022', charset: 'ascii', logLevel: 'warning',
});
const rankWorker = {
  name: 'rank-worker-src',
  setup(b) {
    b.onResolve({ filter: /^rank-worker-src$/ }, () => ({ path: 'rank-worker-src', namespace: 'rw' }));
    b.onLoad({ filter: /.*/, namespace: 'rw' }, () => ({ contents: worker.outputFiles[0].text, loader: 'text' }));
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
  plugins: [workerAsText, rankWorker],
  logLevel: 'warning',
});

const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = (await readFile('web/index.html', 'utf8')).replace('/*APP*/', () => js);
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
