import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { UserRole } from '../enums/user-role.enum';
import { User } from '../models/auth.model';
import { AuthService } from './auth.service';

@Component({ template: '' })
class DummyComponent {}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

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
        ]),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created and initially unauthenticated', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('login should make POST request and save session', () => {
    const mockResponse = {
      success: true,
      data: { accessToken: 'dummy.jwt.token' },
    };

    service.login({ email: 'admin@test.com', password: 'Password1!' }).subscribe((res) => {
      expect(res.data.accessToken).toBe('dummy.jwt.token');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(service.token()).toBe('dummy.jwt.token');
    expect(service.isAuthenticated()).toBe(true);

    // Should also trigger getProfile
    const profileReq = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
    expect(profileReq.request.method).toBe('GET');
  });

  it('logout should clear storage, signals, and navigate to login', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    localStorage.setItem('scrapbid_token', 'sample-token');
    
    service.logout();

    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('scrapbid_token')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('getProfile should update currentUser and userRole', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    };

    service.getProfile().subscribe((res) => {
      expect(res.data.email).toBe('admin@test.com');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockUser });

    expect(service.currentUser()?.email).toBe('admin@test.com');
    expect(service.userRole()).toBe(UserRole.ADMIN);
  });
});
