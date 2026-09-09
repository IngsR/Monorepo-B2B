import { UserRole } from '../enums/user-role.enum';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: string;
  companyId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

export interface JwtPayload {
  sub: string;
  userId: string;
  email: string;
  role: UserRole;
  exp?: number;
  iat?: number;
}
