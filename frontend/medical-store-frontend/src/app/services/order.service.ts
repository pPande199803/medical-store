import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Order } from '../models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private http: HttpClient) {}

  getAll(date = ''): Observable<ApiResponse<Order[]>> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.http.get<ApiResponse<Order[]>>(`${environment.apiUrl}/orders${query}`);
  }

  create(payload: { medicineName: string; quantity: number }): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>(`${environment.apiUrl}/orders`, payload);
  }

  receive(
    id: string,
    payload: {
      expiredDate: string;
      boxNumber: number;
      quantity: number;
      perMedicinePrice: number;
    }
  ): Observable<ApiResponse<{ order: Order; medicine: unknown }>> {
    return this.http.post<ApiResponse<{ order: Order; medicine: unknown }>>(
      `${environment.apiUrl}/orders/${id}/receive`,
      payload
    );
  }

  remove(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${environment.apiUrl}/orders/${id}`);
  }
}
