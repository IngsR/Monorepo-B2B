import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Company } from '../models/company.model';
import { CompanyService } from './company.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CompanyService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CompanyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and have empty companies list', () => {
    expect(service).toBeTruthy();
    expect(service.companies()).toEqual([]);
  });

  it('getCompanies should fetch paginated companies and update signals', () => {
    const mockCompanies: Company[] = [
      {
        id: 'comp-1',
        name: 'PT Metal Prima',
        code: 'MP-01',
        email: 'info@metalprima.co.id',
        phone: null,
        address: null,
        city: 'Surabaya',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    service.getCompanies(1, 10).subscribe((res) => {
      expect(res.data.data.length).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/companies`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        data: mockCompanies,
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      },
    });

    expect(service.companies().length).toBe(1);
    expect(service.companies()[0].code).toBe('MP-01');
    expect(service.meta().total).toBe(1);
  });

  it('createCompany should post data and prepend to companies signal', () => {
    const newCompany: Company = {
      id: 'comp-2',
      name: 'PT Krakatau Scrap',
      code: 'KS-02',
      email: null,
      phone: null,
      address: null,
      city: 'Cilegon',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    service.createCompany({ name: 'PT Krakatau Scrap', code: 'KS-02' }).subscribe((res) => {
      expect(res.data.code).toBe('KS-02');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/companies`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: newCompany });

    expect(service.companies().length).toBe(1);
    expect(service.companies()[0].name).toBe('PT Krakatau Scrap');
  });
});
