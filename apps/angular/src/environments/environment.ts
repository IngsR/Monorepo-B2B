/**
 * Runtime configuration.
 *
 * The NestJS backend mounts every route under `/api` and URI-versions it, so
 * the real base is `http://localhost:8000/api/v1`. Services append resource
 * paths (`/auth/login`, `/auctions`, …) to this value.
 */
export const environment = {
  production: false,
  // Must match the deployed NestJS backend URL, over HTTPS. The browser blocks
  // HTTPS pages from calling an HTTP API (mixed content), so never use http://
  // here for a deployed frontend.
  apiUrl: 'https://backending.vercel.app/api/v1',
};
