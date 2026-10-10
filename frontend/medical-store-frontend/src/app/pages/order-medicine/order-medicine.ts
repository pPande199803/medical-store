import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { environment } from '../../../environments/environment';
import { OrderService } from '../../services/order.service';
import { Order } from '../../models';

@Component({
  selector: 'app-order-medicine',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './order-medicine.html',
  styleUrl: './order-medicine.css',
})
export class OrderMedicine implements OnInit {
  private orderService = inject(OrderService);
  private fb = inject(FormBuilder);

  orderForm: FormGroup;

  orderMedicines = signal<Order[]>([]);
  loading = signal(false);

  showExportMenu = signal(false);
  selectedDate = signal('');

  /* ---------------- RECEIVE INTO DATABASE ---------------- */
  /* When an ordered medicine physically arrives, the user opens this
     small modal and only enters expiry date, box number, quantity and
     price. The backend then adds the stock to the medicine database. */
  receiveOrder = signal<Order | null>(null);
  receiveForm: FormGroup;
  receiving = signal(false);

  constructor() {
    this.orderForm = this.fb.group({
      medicineName: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });

    this.receiveForm = this.fb.group({
      expiredDate: ['', Validators.required],
      boxNumber: [null as number | null, Validators.required],
      quantity: [null as number | null, [Validators.required, Validators.min(1)]],
      perMedicinePrice: [null as number | null, [Validators.required, Validators.min(0)]],
    });
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  /* ---------------- DATA ---------------- */
  loadOrders(): void {
    this.loading.set(true);

    this.orderService.getAll().subscribe({
      next: (res) => {
        this.orderMedicines.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  /* ---------------- ADD MEDICINE ---------------- */
  addMedicine(): void {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    const medicineName = this.orderForm.get('medicineName')?.value?.trim();
    const quantity = Number(this.orderForm.get('quantity')?.value);

    if (!medicineName || quantity <= 0) {
      return;
    }

    this.orderService.create({ medicineName, quantity }).subscribe({
      next: () => {
        this.orderForm.reset({ medicineName: '', quantity: 1 });
        this.loadOrders();
      },
      error: (err) => {
        alert(err?.error?.message || 'Failed to add order.');
      },
    });
  }

  /* ---------------- REMOVE MEDICINE ---------------- */
  removeMedicine(id?: string): void {
    if (!id) {
      return;
    }

    this.orderService.remove(id).subscribe({
      next: () => this.loadOrders(),
      error: (err) => {
        alert(err?.error?.message || 'Failed to remove order.');
      },
    });
  }

  /* ---------------- RECEIVE INTO DATABASE ---------------- */
  openReceiveModal(order: Order): void {
    this.receiveOrder.set(order);

    this.receiveForm.reset({
      expiredDate: '',
      boxNumber: null,
      quantity: order.quantity,
      perMedicinePrice: null,
    });
  }

  closeReceiveModal(): void {
    this.receiveOrder.set(null);
  }

  confirmReceive(): void {
    const order = this.receiveOrder();

    if (!order?._id) {
      return;
    }

    if (this.receiveForm.invalid) {
      this.receiveForm.markAllAsTouched();
      return;
    }

    this.receiving.set(true);

    const payload = {
      expiredDate: this.receiveForm.value.expiredDate,
      boxNumber: Number(this.receiveForm.value.boxNumber),
      quantity: Number(this.receiveForm.value.quantity),
      perMedicinePrice: Number(this.receiveForm.value.perMedicinePrice),
    };

    this.orderService.receive(order._id, payload).subscribe({
      next: () => {
        this.receiving.set(false);
        this.closeReceiveModal();
        this.loadOrders();
        alert('Medicine added to database successfully!');
      },
      error: (err) => {
        this.receiving.set(false);
        alert(err?.error?.message || 'Failed to add medicine to database.');
      },
    });
  }

  /* ---------------- EXPORT MENU ---------------- */
  toggleExportMenu(): void {
    this.showExportMenu.update((value) => !value);
  }

  /* ---------------- DATE FILTER ---------------- */
  filteredOrderMedicines = computed(() => {
    const date = this.selectedDate();

    if (!date) {
      return this.orderMedicines();
    }

    return this.orderMedicines().filter((medicine) => medicine.date === date);
  });

  filterByDate(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedDate.set(input.value);
  }

  clearDateFilter(): void {
    this.selectedDate.set('');
  }

  /* ---------------- EXPORT TO EXCEL ---------------- */
  exportExcel(): void {
    const medicines = this.filteredOrderMedicines();

    if (!medicines.length) {
      alert('No medicine available to export.');
      return;
    }

    const data = medicines.map((medicine, index) => ({
      'Sr.No': index + 1,
      'Medicine Name': medicine.medicineName,
      'Quantity': medicine.quantity,
      'Status': medicine.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Order Medicines');
    XLSX.writeFile(workbook, 'order-medicines.xlsx');

    this.showExportMenu.set(false);
  }

  /* ---------------- EXPORT TO PDF ---------------- */
  exportPdf(): void {
    const medicines = this.filteredOrderMedicines();

    if (!medicines.length) {
      alert('No medicine available to export.');
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Order Medicines', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const rows = medicines.map((medicine, index) => [
      index + 1,
      medicine.medicineName,
      medicine.quantity,
      medicine.status,
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Sr.No', 'Medicine Name', 'Quantity', 'Status']],
      body: rows,
      styles: { fontSize: 10 },
    });

    doc.save('order-medicines.pdf');
    this.showExportMenu.set(false);
  }

  /* ---------------- SEND TO WHATSAPP ---------------- */
  sendToWhatsApp(): void {
    const medicines = this.filteredOrderMedicines();

    if (!medicines.length) {
      alert('No medicine available.');
      return;
    }

    let message = '*Order Medicines*%0A%0A';

    medicines.forEach((medicine, index) => {
      message += `${index + 1}. ${medicine.medicineName} - Qty: ${medicine.quantity}%0A`;
    });

    message += `%0ATotal Items: ${medicines.length}`;

    const whatsappUrl = `${environment.whatsappBaseUrl}/${environment.whatsappNumber}?text=${message}`;

    window.open(whatsappUrl, '_blank');
    this.showExportMenu.set(false);
  }
}

