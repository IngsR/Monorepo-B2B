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
import { authInterceptor, requestIdInterceptor } from './core/interceptors/auth.interceptor';
import { mockApiInterceptor } from './core/interceptors/mock-api.interceptor';

/**
 * Application configuration.
 *
 * HTTP interceptors run in order:
 *   1. `requestIdInterceptor` — correlates client and server logs
 *   2. `authInterceptor` — attaches the bearer token and reacts to 401s
 *   3. `mockApiInterceptor` — terminates requests against the in-memory API
 *
 * The mock transport sits last so it sees the fully-decorated request, exactly
 * as a real server would. Replacing it with the live NestJS backend is a matter
 * of deleting it from this array: every service already issues genuine HTTP calls.
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
      withInterceptors([requestIdInterceptor, authInterceptor, mockApiInterceptor]),
    ),
  ],
};
