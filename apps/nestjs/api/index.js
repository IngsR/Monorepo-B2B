// Vercel serverless entrypoint.
// src/serverless.ts is compiled by `tsc -p tsconfig.build.json` into dist/serverless.js
import handler from '../dist/serverless.js';
export default handler;