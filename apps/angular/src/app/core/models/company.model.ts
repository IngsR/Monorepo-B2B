export interface Company {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyPayload {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateCompanyPayload extends Partial<CreateCompanyPayload> {}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}
