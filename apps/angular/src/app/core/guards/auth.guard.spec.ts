import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard, roleGuard } from './auth.guard';

@Component({ template: '' })
class DummyComponent {}

describe('Auth Guards', () => {
  let authService: AuthService;
  let router: Router;

  const mockRoute = (data: Record<string, unknown> = {}) =>
    ({ data } as unknown as ActivatedRouteSnapshot);

  const mockState = (url = '/test') =>
    ({ url } as unknown as RouterStateSnapshot);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: DummyComponent },
          { path: 'dashboard', component: DummyComponent },
          { path: 'admin', component: DummyComponent },
        ]),
      ],
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('authGuard', () => {
    it('redirects unauthenticated users to /login', () => {
      vi.spyOn(authService, 'isAuthenticated').mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute(), mockState('/dashboard')),
      );

      expect(result instanceof UrlTree).toBe(true);
      expect((result as UrlTree).toString()).toContain('/login?returnUrl=%2Fdashboard');
    });

    it('allows authenticated users to proceed', () => {
      vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute(), mockState('/dashboard')),
      );

      expect(result).toBe(true);
    });
  });

  describe('guestGuard', () => {
    it('allows unauthenticated guest users to access login', () => {
      vi.spyOn(authService, 'isAuthenticated').mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        guestGuard(mockRoute(), mockState('/login')),
      );

      expect(result).toBe(true);
    });

    it('redirects already logged-in users to /dashboard', () => {
      vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        guestGuard(mockRoute(), mockState('/login')),
      );

      expect(result instanceof UrlTree).toBe(true);
      expect((result as UrlTree).toString()).toBe('/dashboard');
    });
  });

  describe('roleGuard', () => {
    it('allows access when user has expected role', () => {
      vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(authService, 'userRole').mockReturnValue(UserRole.ADMIN);

      const result = TestBed.runInInjectionContext(() =>
        roleGuard(mockRoute({ roles: [UserRole.ADMIN] }), mockState('/admin')),
      );

      expect(result).toBe(true);
    });

    it('redirects to /dashboard when user does not have expected role', () => {
      vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);
      vi.spyOn(authService, 'userRole').mockReturnValue(UserRole.SELLER);

      const result = TestBed.runInInjectionContext(() =>
        roleGuard(mockRoute({ roles: [UserRole.ADMIN] }), mockState('/admin')),
      );

      expect(result instanceof UrlTree).toBe(true);
      expect((result as UrlTree).toString()).toBe('/dashboard');
    });
  });
});
