import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Medicine } from '../models';

@Injectable({ providedIn: 'root' })
export class MedicineService {
  constructor(private http: HttpClient) {}

  getAll(search = ''): Observable<ApiResponse<Medicine[]>> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get<ApiResponse<Medicine[]>>(`${environment.apiUrl}/medicines${query}`);
  }

  getById(id: string): Observable<ApiResponse<Medicine>> {
    return this.http.get<ApiResponse<Medicine>>(`${environment.apiUrl}/medicines/${id}`);
  }

  create(medicine: Partial<Medicine>): Observable<ApiResponse<Medicine>> {
    return this.http.post<ApiResponse<Medicine>>(`${environment.apiUrl}/medicines`, medicine);
  }

  update(id: string, medicine: Partial<Medicine>): Observable<ApiResponse<Medicine>> {
    return this.http.put<ApiResponse<Medicine>>(`${environment.apiUrl}/medicines/${id}`, medicine);
  }

  addStock(
    id: string,
    payload: { quantity: number; expiredDate?: string; boxNumber?: number; perMedicinePrice?: number }
  ): Observable<ApiResponse<Medicine>> {
    return this.http.patch<ApiResponse<Medicine>>(
      `${environment.apiUrl}/medicines/${id}/add-stock`,
      payload
    );
  }

  reduceStock(id: string, payload: { quantity: number }): Observable<ApiResponse<Medicine>> {
    return this.http.patch<ApiResponse<Medicine>>(
      `${environment.apiUrl}/medicines/${id}/reduce-stock`,
      payload
    );
  }

  remove(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${environment.apiUrl}/medicines/${id}`);
  }
}
