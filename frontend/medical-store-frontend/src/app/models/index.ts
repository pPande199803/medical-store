/*
  Shared data models used across the app.
*/

export interface Medicine {
  _id?: string;
  name: string;
  perMedicinePrice: number;
  stripPrice: number;
  boxNumber: number | string;
  stockAvailable: number;
  inStock: boolean;
  expiredDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  medicalName: string;
  email: string;
  logo?: string;
  phone?: string;
  address?: string;
  createdAt?: string;
}

export interface BillItem {
  id?: string;
  medicineId?: string;
  name: string;
  quantity: number;
  perMedicinePrice: number;
  totalPrice: number;
  expiredDate?: string;
}

export interface Bill {
  _id?: string;
  billNumber?: string;
  customerName: string;
  mobileNumber: string;
  items: BillItem[];
  totalAmount: number;
  discount: number;
  discountAmount: number;
  finalAmount: number;
  createdAt?: string;
}

export interface Order {
  _id?: string;
  medicineName: string;
  quantity: number;
  date: string;
  status: 'pending' | 'received';
  received?: {
    expiredDate?: string;
    boxNumber?: number;
    quantity?: number;
    perMedicinePrice?: number;
    receivedAt?: string;
  };
  createdAt?: string;
}

/* Standard API envelope returned by the backend. */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  token?: string;
}
