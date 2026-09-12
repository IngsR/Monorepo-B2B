/**
 * Build harness.
 *
 * The workspace ships `@angular/build` (v22) but not the `@angular/cli` package,
 * so `ng build` is unavailable. This script drives the same builder the CLI would
 * use, with the options from `angular.json`, so the production build — including
 * full Angular template type checking — is still exercised.
 *
 * Usage: node tools/build.mjs [--dev]
 */
import { buildApplicationInternal } from '@angular/build/private';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dev = process.argv.includes('--dev');
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(projectRoot);

// The builder expects a CLI-like context. Read the real angular.json so the
// project metadata it consults matches what the project actually declares.
const workspace = JSON.parse(await readFile(resolve(projectRoot, 'angular.json'), 'utf8'));
const projectName = 'angular';
const projectConfig = workspace.projects[projectName];

const result = await buildApplicationInternal(
  {
    browser: 'src/main.ts',
    tsConfig: 'tsconfig.app.json',
    inlineStyleLanguage: 'scss',
    assets: [{ glob: '**/*', input: 'public' }],
    styles: ['src/styles.scss'],
    // Absolute so the internal builder resolves the destination correctly.
    outputPath: { base: resolve(projectRoot, 'dist/harness'), browser: '' },
    index: 'src/index.html',
    ...(dev
      ? { optimization: false, sourceMap: true, extractLicenses: false }
      : {
          optimization: {
            scripts: true,
            styles: true,
            // Font inlining fetches Google Fonts at build time, which makes the
            // build fail on an offline or firewalled machine. Left off, the
            // <link> stays a runtime request and the system font stack covers
            // the fallback.
            fonts: false,
          },
          sourceMap: false,
          extractLicenses: true,
          outputHashing: 'all',
        }),
  },
  {
    // Write to disk so bundle sizes and lazy-chunk splitting are real.
    write: true,
    // `workspaceRoot` is normally supplied by the Angular CLI. Without it the
    // builder cannot resolve @angular/core to assert version compatibility.
    workspaceRoot: projectRoot,
    target: { project: projectName },
    // The CLI resolves project metadata from angular.json; supply the same.
    getProjectMetadata: async () => projectConfig,
    addTeardown: () => undefined,
    logger: {
      info: (msg) => console.log(msg),
      warn: (msg) => console.warn(msg),
      error: (msg) => console.error(msg),
      debug: () => undefined,
    },
    // Surface every diagnostic so a template error fails the build loudly.
    cacheOptions: { enabled: false },
  },
);

let errors = 0;
let warnings = 0;

/**
 * `ResultKind` is a numeric enum: 0 = Failure, 1 = Full.
 * Compiler diagnostics are attached to the Failure result, so a build error
 * must be counted here — otherwise the script would report success on broken code.
 */
for await (const event of result) {
  const diagnostics = [...(event.errors ?? []), ...(event.warnings ?? [])];

  for (const d of diagnostics) {
    const text = typeof d.message === 'string' ? d.message : d.message?.text ?? String(d);
    if (d.level === 'error' || event.kind === 0) {
      errors += 1;
      console.error(`ERROR: ${text}`);
    } else if (d.level === 'warning') {
      warnings += 1;
      console.warn(`WARN: ${text}`);
    }
  }
}

console.log('');
console.log(`Templates and TypeScript: ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);
