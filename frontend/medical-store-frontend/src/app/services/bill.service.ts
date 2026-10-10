import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Bill } from '../models';

@Injectable({ providedIn: 'root' })
export class BillService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResponse<Bill[]>> {
    return this.http.get<ApiResponse<Bill[]>>(`${environment.apiUrl}/bills`);
  }

  /* Delete every bill saved on one date (YYYY-MM-DD). */
  deleteByDate(date: string): Observable<ApiResponse<{ deletedCount: number }>> {
    return this.http.delete<ApiResponse<{ deletedCount: number }>>(
      `${environment.apiUrl}/bills?date=${encodeURIComponent(date)}`
    );
  }

  getById(id: string): Observable<ApiResponse<Bill>> {
    return this.http.get<ApiResponse<Bill>>(`${environment.apiUrl}/bills/${id}`);
  }

  create(bill: Partial<Bill>): Observable<ApiResponse<Bill>> {
    return this.http.post<ApiResponse<Bill>>(`${environment.apiUrl}/bills`, bill);
  }
}
