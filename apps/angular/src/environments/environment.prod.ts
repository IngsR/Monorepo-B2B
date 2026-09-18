/**
 * Runtime configuration — production.
 *
 * Uses a relative base path so Angular and the NestJS serverless function
 * share the same Vercel domain. Vercel rewrites /api/* to the NestJS handler,
 * so no cross-origin requests are needed in production.
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
};
