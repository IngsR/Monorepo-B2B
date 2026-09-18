/**
 * Runtime configuration — development.
 *
 * The NestJS backend mounts every route under `/api` and URI-versions it, so
 * the real base is `http://localhost:8000/api/v1`. Services append resource
 * paths (`/auth/login`, `/auctions`, …) to this value.
 *
 * For production the file is swapped with environment.prod.ts via angular.json
 * fileReplacements, which uses a relative path so frontend and API share the
 * same Vercel domain.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api/v1',
};

