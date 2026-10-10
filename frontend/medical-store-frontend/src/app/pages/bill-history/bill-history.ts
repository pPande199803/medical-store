import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { BillService } from '../../services/bill.service';
import { Bill } from '../../models';

@Component({
  selector: 'app-bill-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './bill-history.html',
  styleUrl: './bill-history.css',
})
export class BillHistory implements OnInit {
  private billService = inject(BillService);

  bills = signal<Bill[]>([]);
  loading = signal(false);
  searchText = signal('');

  /* Bill currently shown in the detail view. */
  selectedBill = signal<Bill | null>(null);

  /* ---------------- DATE FILTER ---------------- */
  /* Selected calendar day (YYYY-MM-DD) from the date picker. */
  filterDate = signal('');

  /* Two-step confirmation so nobody wipes a day with one stray click. */
  armedDelete = signal(false);

  /* Small success/error banner shown above the table. */
  notice = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  /* Bills of the selected date only (all bills when no date is picked). */
  dateFilteredBills = computed(() => {
    const date = this.filterDate();

    if (!date) {
      return this.bills();
    }

    const key = date.replace(/-/g, '/'); // "YYYY/MM/DD"
    return this.bills().filter((bill) => this.formatDate(bill.createdAt) === key);
  });

  /* ---------------- SUMMARY (follows the date filter) ---------------- */
  totalBills = computed(() => this.dateFilteredBills().length);
  totalRevenue = computed(() =>
    this.dateFilteredBills().reduce((sum, bill) => sum + (bill.finalAmount || 0), 0)
  );

  /* Number of bills the delete button would remove. */
  deleteCount = computed(() => this.dateFilteredBills().length);

  filteredBills = computed(() => {
    const search = this.searchText().trim().toLowerCase();
    const dateBills = this.dateFilteredBills();

    if (!search) {
      return dateBills;
    }

    return dateBills.filter((bill) =>
      (bill.billNumber || '').toLowerCase().includes(search) ||
      (bill.customerName || '').toLowerCase().includes(search) ||
      (bill.mobileNumber || '').includes(search)
    );
  });

  ngOnInit(): void {
    this.loadBills();
  }

  loadBills(): void {
    this.loading.set(true);

    this.billService.getAll().subscribe({
      next: (res) => {
        this.bills.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchText.set(input.value);
  }

  /* ---------------- DATE FILTER ACTIONS ---------------- */
  setFilterDate(value: string): void {
    this.filterDate.set(value);
    this.armedDelete.set(false);
    this.notice.set(null);
  }

  clearFilterDate(): void {
    this.setFilterDate('');
  }

  /* First click arms the button, second click deletes that day's bills. */
  confirmDeleteDate(): void {
    const date = this.filterDate();

    if (!date || this.deleteCount() === 0) {
      return;
    }

    if (!this.armedDelete()) {
      this.armedDelete.set(true);
      return;
    }

    this.armedDelete.set(false);

    this.billService.deleteByDate(date).subscribe({
      next: (res) => {
        this.notice.set({
          text: res.message || 'Bills deleted.',
          type: 'success',
        });
        this.loadBills();
      },
      error: (err) => {
        this.notice.set({
          text: err?.error?.message || 'Failed to delete bills.',
          type: 'error',
        });
      },
    });
  }

  /* ---------------- DETAIL VIEW ---------------- */
  openBill(bill: Bill): void {
    this.selectedBill.set(bill);
  }

  closeBill(): void {
    this.selectedBill.set(null);
  }

  printBill(): void {
    window.print();
  }

  itemCount(bill: Bill): number {
    return bill.items?.length || 0;
  }

  /* ---------------- DATE HELPERS ---------------- */
  formatDate(date: string | Date | undefined | null): string {
    if (!date) {
      return '';
    }

    const str = typeof date === 'string' ? date : date.toISOString();
    return str.split('T')[0].replace(/-/g, '/');
  }

  formatDateTime(date: string | Date | undefined | null): string {
    if (!date) {
      return '';
    }

    const d = new Date(date);
    const datePart = this.formatDate(date);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `${datePart} ${time}`;
  }

  /* ---------------- EXPORT EXCEL ---------------- */
  exportExcel(): void {
    const bills = this.filteredBills();

    if (!bills.length) {
      alert('No bills available to export.');
      return;
    }

    const data = bills.map((bill, index) => ({
      'Sr.No': index + 1,
      'Bill Number': bill.billNumber || '',
      'Customer Name': bill.customerName || '',
      'Mobile Number': bill.mobileNumber || '',
      'Items': this.itemCount(bill),
      'Total Amount': bill.totalAmount || 0,
      'Discount %': bill.discount || 0,
      'Final Amount': bill.finalAmount || 0,
      'Date': this.formatDate(bill.createdAt),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bill History');
    XLSX.writeFile(workbook, 'bill-history.xlsx');
  }

  /* ---------------- EXPORT PDF ---------------- */
  exportPdf(): void {
    const bills = this.filteredBills();

    if (!bills.length) {
      alert('No bills available to export.');
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Bill History', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const rows = bills.map((bill, index) => [
      index + 1,
      bill.billNumber || '',
      bill.customerName || '',
      bill.mobileNumber || '',
      this.itemCount(bill),
      (bill.finalAmount || 0).toFixed(2),
      this.formatDate(bill.createdAt),
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Sr.No', 'Bill No', 'Customer', 'Mobile', 'Items', 'Final (₹)', 'Date']],
      body: rows,
      styles: { fontSize: 9 },
    });

    doc.save('bill-history.pdf');
  }
}
