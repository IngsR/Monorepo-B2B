/**
 * Runtime configuration.
 *
 * The NestJS backend mounts every route under `/api` and URI-versions it, so
 * the real base is `http://localhost:8000/api/v1`. Services append resource
 * paths (`/auth/login`, `/auctions`, …) to this value.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api/v1',
};
