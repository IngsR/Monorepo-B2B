// Vercel serverless entrypoint (must be inside /api directory).
// nestjs/dist/serverless.js is compiled by `tsc -p tsconfig.build.json`
import handler from '../nestjs/dist/serverless.js';
export default handler;
