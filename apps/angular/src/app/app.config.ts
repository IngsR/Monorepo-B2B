import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { routes } from './app.routes';
import { apiShapeInterceptor } from './core/interceptors/api-shape.interceptor';
import { authInterceptor, requestIdInterceptor } from './core/interceptors/auth.interceptor';

/**
 * Application configuration.
 *
 * HTTP interceptors run in order:
 *   1. `requestIdInterceptor` — correlates client and server logs
 *   2. `authInterceptor` — attaches the bearer token and reacts to 401s
 *   3. `apiShapeInterceptor` — normalises the NestJS response into the shapes
 *      the UI models expect (pagination key, field names, timing fields)
 *
 * Requests go to the live NestJS backend at `environment.apiUrl`; there is no
 * in-memory mock in the path any more.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      // Bind route parameters directly to component inputs.
      withComponentInputBinding(),
      // Restore scroll position on back/forward, reset it on new navigation.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    provideHttpClient(
      withInterceptors([requestIdInterceptor, authInterceptor, apiShapeInterceptor]),
    ),
  ],
};
