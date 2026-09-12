import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../domain/models';

/**
 * Thin base class for resource services.
 *
 * Centralises the base URL and unwraps the `{ success, data, message }` envelope
 * so feature services deal in domain types rather than transport shapes.
 * Errors are intentionally left to propagate: the auth interceptor handles 401,
 * and each caller maps the rest through `toApiFailure`.
 */
@Injectable()
export abstract class ApiClient {
  protected readonly baseUrl = environment.apiUrl;

  /** Unwraps a successful envelope into its payload. */
  protected unwrap<T>(): (source: Observable<ApiSuccess<T>>) => Observable<T> {
    return map((res) => res.data);
  }

  /** Builds a URL for a resource path, collapsing duplicate slashes. */
  protected url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
}

/** Injects any ApiClient subclass without repeating the boilerplate. */
export function injectApi<T extends ApiClient>(ctor: new (...args: never[]) => T): T {
  return inject(ctor);
}
