/**
 * Minimal static file server for the built bundle.
 *
 * The workspace has no `@angular/cli`, so `ng serve` is unavailable. This serves
 * the production output from `tools/build.mjs` instead, with SPA fallback to
 * index.html so deep links resolve through the router. Used only to verify that
 * the real production bundle boots and renders.
 *
 * Usage: node tools/serve.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const port = Number(process.argv[2] ?? 3000);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'harness', 'browser');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

async function exists(path) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // Prevent path traversal outside the build output.
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, safePath);

  if (!(await exists(filePath))) {
    // SPA fallback: unknown paths are routed by the client router.
    filePath = join(root, 'index.html');
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Server error: ${error.message}`);
  }
});

server.listen(port, () => {
  console.log(`Serving ${root}`);
  console.log(`http://localhost:${port}`);
});
