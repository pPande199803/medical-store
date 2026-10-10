import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'medical_store_token';
  private readonly userKey = 'medical_store_user';

  currentUser = signal<User | null>(this.readUser());

  constructor(private http: HttpClient) {}

  private readUser(): User | null {
    try {
      const raw = localStorage.getItem(this.userKey);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  register(payload: {
    medicalName: string;
    email: string;
    password: string;
    logo?: string;
  }): Observable<ApiResponse<User>> {
    return this.http
      .post<ApiResponse<User>>(`${environment.apiUrl}/auth/register`, payload)
      .pipe(tap((res) => this.persist(res)));
  }

  login(payload: { email: string; password: string }): Observable<ApiResponse<User>> {
    return this.http
      .post<ApiResponse<User>>(`${environment.apiUrl}/auth/login`, payload)
      .pipe(tap((res) => this.persist(res)));
  }

  me(): Observable<ApiResponse<User>> {
    return this.http
      .get<ApiResponse<User>>(`${environment.apiUrl}/auth/me`)
      .pipe(
        tap((res) => {
          this.currentUser.set(res.data);
          localStorage.setItem(this.userKey, JSON.stringify(res.data));
        })
      );
  }

  updateProfile(payload: Partial<User> & { password?: string }): Observable<ApiResponse<User>> {
    return this.http
      .put<ApiResponse<User>>(`${environment.apiUrl}/auth/me`, payload)
      .pipe(
        tap((res) => {
          this.currentUser.set(res.data);
          localStorage.setItem(this.userKey, JSON.stringify(res.data));
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUser.set(null);
  }

  private persist(res: ApiResponse<User>): void {
    if (res?.token) {
      localStorage.setItem(this.tokenKey, res.token);
    }
    if (res?.data) {
      this.currentUser.set(res.data);
      localStorage.setItem(this.userKey, JSON.stringify(res.data));
    }
  }
}
