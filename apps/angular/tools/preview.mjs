/**
 * In-memory build + serve harness.
 *
 * The workspace lacks `@angular/cli`, and the internal builder does not write to
 * disk when driven outside the CLI. So the emitted files are captured in memory
 * and served directly from them — which still exercises the exact production
 * bundle (optimised, minified, lazy-split) and the real router.
 *
 * Usage: node tools/preview.mjs [port]
 */
import { buildApplicationInternal } from '@angular/build/private';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 3000);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(projectRoot);

const result = await buildApplicationInternal(
  {
    browser: 'src/main.ts',
    tsConfig: 'tsconfig.app.json',
    inlineStyleLanguage: 'scss',
    assets: [{ glob: '**/*', input: 'public' }],
    styles: ['src/styles.scss'],
    outputPath: resolve(projectRoot, 'dist/preview'),
    index: 'src/index.html',
    optimization: {
      scripts: true,
      styles: true,
      // Do not inline Google Fonts. Inlining fetches them at build time, so an
      // offline or firewalled machine fails the build; leaving it off keeps the
      // <link> as a runtime request and the system font stack as the fallback.
      fonts: false,
    },
    sourceMap: false,
    extractLicenses: true,
    outputHashing: 'all',
  },
  {
    write: false,
    workspaceRoot: projectRoot,
    target: { project: 'angular' },
    getProjectMetadata: async () => ({ root: '', sourceRoot: 'src' }),
    addTeardown: () => undefined,
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    },
    cacheOptions: { enabled: false },
  },
);

// The builder reports emitted files through its event stream as a `Full`
// result, not through `outputFiles`. `ResultKind` is a numeric enum:
// 0 = Failure, 1 = Full, 2 = Incremental, 3 = ComponentUpdate.
const RESULT_FULL = 1;
let emittedFiles = {};
for await (const event of result) {
  if (event.kind === RESULT_FULL) {
    emittedFiles = event.files ?? {};
  } else if (event.kind === 0) {
    console.error('Build reported a Failure result.');
  }
}

if (Object.keys(emittedFiles).length === 0) {
  console.error('No Full result captured from the build event stream.');
  process.exit(1);
}

const files = new Map();
for (const [path, file] of Object.entries(emittedFiles)) {
  const name = '/' + path.replace(/^\/+/, '');
  if (file.contents) {
    files.set(name, Buffer.from(file.contents));
  } else if (file.inputPath) {
    // Assets originate on disk; read them in.
    try {
      files.set(name, await readFile(file.inputPath));
    } catch {
      // A missing optional asset should not stop the preview.
    }
  }
}

if (files.size === 0) {
  console.error('Build produced no output files — nothing to serve.');
  process.exit(1);
}

console.log(`Serving ${files.size} files (${[...files.keys()].slice(0, 6).join(', ')}…)`);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const indexHtml = files.get('/index.html');
if (!indexHtml) {
  console.error('index.html missing from the build output.');
  process.exit(1);
}

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const body =
    files.get(path) ?? (path === '/index.html' || !extname(path) ? indexHtml : undefined);

  if (!body) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type':
      MIME[extname(path)] ?? (path.includes('.js') ? MIME['.js'] : 'text/html; charset=utf-8'),
    'Cache-Control': 'no-store',
  });
  res.end(Buffer.from(body));
});

server.listen(port, () => {
  console.log(`Preview ready on http://localhost:${port} (${files.size} files in memory)`);
});
