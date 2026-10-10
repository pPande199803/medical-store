import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MedicineService } from '../../services/medicine.service';
import { BillService } from '../../services/bill.service';
import { AuthService } from '../../services/auth.service';
import { Medicine, BillItem } from '../../models';

/* How many single medicines make up one strip. */
const MEDICINES_PER_STRIP = 10;

/* Snapshot of the bill that is rendered on the printable sheet.
   It is captured BEFORE the screen is reset, because the print
   dialog opens after the bill has already been saved & cleared. */
interface PrintableBill {
  customerName: string;
  mobileNumber: string;
  items: BillItem[];
  totalAmount: number;
  discount: number;
  discountAmount: number;
  finalAmount: number;
  printedAt: string;
}

/* 10 digits when a number is given — but empty is allowed, because
   walk-in customers don't have to share their mobile number. */
function optionalMobileValidator(control: { value: unknown }) {
  const value = String(control.value ?? '').trim();

  if (!value) {
    return null;
  }

  return /^[0-9]{10}$/.test(value) ? null : { pattern: true };
}

@Component({
  selector: 'app-new-bill',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-bill.html',
  styleUrl: './new-bill.css',
})
export class NewBill {
  private medicineService = inject(MedicineService);
  private billService = inject(BillService);
  private fb = inject(FormBuilder);

  /* Store details (medical name, logo, contact, address) used on the
     printable bill header. */
  auth = inject(AuthService);
  user = this.auth.currentUser;

  /* Refs so we can move focus with the keyboard only. */
  searchInput = viewChild<HTMLInputElement>('searchInput');
  qtyInput = viewChild<HTMLInputElement>('qtyInput');

  /* ---------------- CUSTOMER ---------------- */
  customerForm: FormGroup;

  /* ---------------- MEDICINES (from API) ---------------- */
  medicines = signal<Medicine[]>([]);
  loadingMedicines = signal(false);

  /* ---------------- SEARCH ---------------- */
  searchText = signal('');
  selectedSearchIndex = signal(-1);

  searchResults = computed(() => {
    const search = this.searchText().trim().toLowerCase();

    if (!search) {
      return [];
    }

    return this.medicines().filter(
      (medicine) =>
        medicine.name.toLowerCase().includes(search) &&
        medicine.inStock &&
        medicine.stockAvailable > 0
    );
  });

  /* ---------------- BILL ---------------- */
  billItems = signal<BillItem[]>([]);

  /* ---------------- INLINE QUANTITY (no popup) ---------------- */
  /* When a medicine is picked we show a quantity row right under the
     search box instead of a modal popup. The user types the number and
     presses Enter — fast and fully keyboard driven. */
  quickAddMedicine = signal<Medicine | null>(null);

  /* Unit the user is billing in: single tablet or full strip. */
  quantityUnit = signal<'tablet' | 'strip'>('tablet');
  quickQuantity = signal(1);

  /* ---------------- DISCOUNT ---------------- */
  discount = signal(0);

  /* ---------------- PRINT ---------------- */
  /* Snapshot of the bill shown on the printable sheet. */
  printData = signal<PrintableBill | null>(null);

  /* ---------------- STATE ---------------- */
  adding = signal(false);
  saving = signal(false);

  /* ---------------- CALCULATIONS ---------------- */
  totalAmount = computed(() =>
    this.billItems().reduce((total, item) => total + item.totalPrice, 0)
  );

  discountAmount = computed(() => (this.totalAmount() * this.discount()) / 100);

  finalAmount = computed(() => this.totalAmount() - this.discountAmount());

  /* Medicines per strip for the currently selected medicine
     (derived from strip price / per-tablet price, fallback to 10). */
  medicinesPerStrip = computed(() => {
    const med = this.quickAddMedicine();

    if (!med || !med.perMedicinePrice) {
      return MEDICINES_PER_STRIP;
    }

    const derived = Math.round(med.stripPrice / med.perMedicinePrice);

    return derived > 0 ? derived : MEDICINES_PER_STRIP;
  });

  /* Total single tablets represented by the current quick-add quantity. */
  quickTabletQuantity = computed(() => {
    const qty = this.quickQuantity();

    return this.quantityUnit() === 'strip'
      ? qty * this.medicinesPerStrip()
      : qty;
  });

  quickLineTotal = computed(() => {
    const med = this.quickAddMedicine();

    if (!med) {
      return 0;
    }

    return this.quickTabletQuantity() * med.perMedicinePrice;
  });

  constructor() {
    this.customerForm = this.fb.group({
      customerName: [''],
      mobileNumber: ['', [optionalMobileValidator]],
    });

    this.loadMedicines();

    /* Whenever the quick-add row appears, focus its quantity input. */
    effect(() => {
      if (this.quickAddMedicine()) {
        setTimeout(() => {
          const el = this.qtyInput();
          if (el) {
            el.focus();
            el.select();
          }
        });
      }
    });
  }

  /* ---------------- DATA ---------------- */
  loadMedicines(): void {
    this.loadingMedicines.set(true);

    this.medicineService.getAll().subscribe({
      next: (res) => {
        this.medicines.set(res.data || []);
        this.loadingMedicines.set(false);
      },
      error: () => {
        this.loadingMedicines.set(false);
      },
    });
  }

  get customerName() {
    return this.customerForm.get('customerName');
  }

  get mobileNumber() {
    return this.customerForm.get('mobileNumber');
  }

  /* ---------------- SEARCH ---------------- */
  updateSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchText.set(input.value);
    this.selectedSearchIndex.set(-1);
  }

  /* ---------------- SELECT MEDICINE (keyboard flow) ---------------- */
  selectMedicine(medicine: Medicine) {
    this.quickAddMedicine.set(medicine);
    this.quickQuantity.set(1);
    this.quantityUnit.set('tablet');
    this.selectedSearchIndex.set(-1);
  }

  /* ---------------- UNIT TOGGLE (tablet <-> strip) ---------------- */
  setQuantityUnit(unit: 'tablet' | 'strip') {
    this.quantityUnit.set(unit);
    this.quickQuantity.set(1);
  }

  /* ---------------- QUANTITY ---------------- */
  onQuickQuantityChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const medicine = this.quickAddMedicine();

    if (!medicine) {
      return;
    }

    let value = Number(input.value);

    if (!Number.isFinite(value) || value < 1) {
      value = 1;
    }

    /* Clamp so we never exceed available stock. */
    const maxUnits =
      this.quantityUnit() === 'strip'
        ? Math.floor(medicine.stockAvailable / this.medicinesPerStrip())
        : medicine.stockAvailable;

    if (value > maxUnits) {
      value = Math.max(1, maxUnits);
    }

    this.quickQuantity.set(value);
  }

  /* ---------------- ADD TO BILL (deducts stock immediately) ---------------- */
  addToBill() {
    const medicine = this.quickAddMedicine();

    if (!medicine || this.adding()) {
      return;
    }

    const tabletQty = this.quickTabletQuantity();

    if (tabletQty <= 0 || tabletQty > medicine.stockAvailable) {
      alert(`Only ${medicine.stockAvailable} units available.`);
      return;
    }

    this.adding.set(true);

    /* Deduct the stock from the database right away. */
    this.medicineService.reduceStock(medicine._id!, { quantity: tabletQty }).subscribe({
      next: (res) => {
        this.adding.set(false);

        /* Update the in-memory stock so the UI reflects it. */
        const remaining = res.data.stockAvailable;

        this.medicines.update((list) =>
          list.map((m) =>
            m._id === medicine._id
              ? { ...m, stockAvailable: remaining, inStock: remaining > 0 }
              : m
          )
        );

        this.pushItem(medicine, tabletQty);
        this.closeQuickAdd();
      },
      error: (err) => {
        this.adding.set(false);
        alert(err?.error?.message || 'Not enough stock available.');
      },
    });
  }

  private pushItem(medicine: Medicine, tabletQty: number) {
    const existingItem = this.billItems().find((item) => item.medicineId === medicine._id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + tabletQty;

      this.billItems.update((items) =>
        items.map((item) =>
          item.medicineId === medicine._id
            ? {
                ...item,
                quantity: newQuantity,
                totalPrice: newQuantity * medicine.perMedicinePrice,
              }
            : item
        )
      );
    } else {
      const newItem: BillItem = {
        medicineId: medicine._id,
        name: medicine.name,
        quantity: tabletQty,
        perMedicinePrice: medicine.perMedicinePrice,
        expiredDate: medicine.expiredDate,
        totalPrice: tabletQty * medicine.perMedicinePrice,
      };

      this.billItems.update((items) => [...items, newItem]);
    }
  }

  closeQuickAdd() {
    this.quickAddMedicine.set(null);
    this.quickQuantity.set(1);
    this.quantityUnit.set('tablet');
    this.searchText.set('');
    this.selectedSearchIndex.set(-1);

    /* Return focus to the search box so the user can keep typing. */
    setTimeout(() => this.searchInput()?.focus());
  }

  /* ---------------- REMOVE ITEM (restores stock) ---------------- */
  removeItem(id?: string) {
    const item = this.billItems().find((i) => i.medicineId === id);

    if (!item || !id) {
      return;
    }

    /* Put the reserved quantity back into the database. */
    this.medicineService.addStock(id, { quantity: item.quantity }).subscribe({
      next: (res) => {
        const restored = res.data.stockAvailable;

        this.medicines.update((list) =>
          list.map((m) =>
            m._id === id ? { ...m, stockAvailable: restored, inStock: restored > 0 } : m
          )
        );
      },
      error: () => {
        /* Keep going even if the restore call fails. */
      },
    });

    this.billItems.update((items) => items.filter((i) => i.medicineId !== id));
  }

  /* ---------------- DISCOUNT ---------------- */
  updateDiscount(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.discount.set(Number(select.value));
  }

  /* ---------------- SAVE (records bill, stock already deducted) ---------------- */
  saveData() {
    if (this.billItems().length === 0) {
      alert('Please add at least one medicine.');
      return;
    }

    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      alert('Mobile number must be 10 digits — or leave it empty for walk-in customers.');
      return;
    }

    this.saving.set(true);

    this.billService.create(this.buildBillPayload()).subscribe({
      next: () => {
        this.saving.set(false);
        alert('Bill saved successfully!');
        this.resetBill();
      },
      error: (err) => {
        this.saving.set(false);
        alert(err?.error?.message || 'Failed to save bill. Please try again.');
      },
    });
  }

  /* ---------------- PRINT + SAVE ---------------- */
  printAndSave() {
    if (this.customerForm.invalid || this.billItems().length === 0) {
      this.saveData();
      return;
    }

    /* Snapshot the bill BEFORE it is saved & reset, otherwise the
       printable sheet would be empty when the dialog opens. */
    this.printData.set({
      ...this.buildBillPayload(),
      printedAt: new Date().toISOString(),
    });

    this.saving.set(true);

    this.billService.create(this.buildBillPayload()).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetBill();
        this.openPrintSheet();
      },
      error: (err) => {
        this.saving.set(false);
        alert(err?.error?.message || 'Failed to save bill. Please try again.');
      },
    });
  }

  /* Puts <body> into the "printing-bill" state (global print CSS then
     shows only the .bill-print-sheet) and opens the print dialog. */
  private openPrintSheet(): void {
    document.body.classList.add('printing-bill');

    /* One tick so Angular can render the sheet before printing. */
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-bill');
    }, 200);
  }

  /* ---------------- CLEAR / CANCEL BILL (restores reserved stock) ---------------- */
  /* Used when a customer walks away without completing the purchase.
     All quantities that were deducted are added back to the database
     and the whole screen is reset. */
  clearBill() {
    const items = this.billItems();

    if (items.length === 0) {
      this.resetBill();
      return;
    }

    if (!confirm('Clear this bill? All added medicines will be returned to stock.')) {
      return;
    }

    let pending = items.length;

    items.forEach((item) => {
      this.medicineService.addStock(item.medicineId!, { quantity: item.quantity }).subscribe({
        next: (res) => {
          const restored = res.data.stockAvailable;

          this.medicines.update((list) =>
            list.map((m) =>
              m._id === item.medicineId
                ? { ...m, stockAvailable: restored, inStock: restored > 0 }
                : m
            )
          );
        },
        error: () => {
          /* ignore individual restore failures */
        },
        complete: () => {
          pending -= 1;
          if (pending === 0) {
            this.resetBill();
          }
        },
      });
    });

    /* Reset the screen immediately for a snappy feel. */
    this.billItems.set([]);
    this.discount.set(0);
    this.customerForm.reset();
    this.closeQuickAdd();
  }

  private buildBillPayload() {
    return {
      customerName: this.customerForm.value.customerName?.trim() || '',
      mobileNumber: this.customerForm.value.mobileNumber?.trim() || '',
      items: this.billItems(),
      totalAmount: this.totalAmount(),
      discount: this.discount(),
      discountAmount: this.discountAmount(),
      finalAmount: this.finalAmount(),
    };
  }

  resetBill() {
    this.billItems.set([]);
    this.discount.set(0);
    this.customerForm.reset();
    this.closeQuickAdd();
    this.loadMedicines();
  }

  /* ---------------- DATE FORMAT (YYYY/MM/DD) ---------------- */
  /* Treats the stored value as a calendar date and avoids any
     timezone shifting that the Angular date pipe could introduce. */
  formatDate(date: string | Date | undefined | null): string {
    if (!date) {
      return '';
    }

    const str = typeof date === 'string' ? date : date.toISOString();
    const day = str.split('T')[0]; // "YYYY-MM-DD"

    return day.replace(/-/g, '/'); // "YYYY/MM/DD"
  }

  /* Date + time used on the printable bill. */
  formatDateTime(value: string | Date | undefined | null): string {
    if (!value) {
      return '';
    }

    const time = new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${this.formatDate(value)} ${time}`;
  }

  /* ---------------- KEYBOARD NAVIGATION ---------------- */
  onSearchKeydown(event: KeyboardEvent) {
    const results = this.searchResults();

    if (event.key === 'ArrowDown') {
      if (!results.length) return;
      event.preventDefault();
      this.selectedSearchIndex.update((index) =>
        index < results.length - 1 ? index + 1 : 0
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      this.selectedSearchIndex.update((index) =>
        index > 0 ? index - 1 : results.length - 1
      );
      return;
    }

    /* Enter -> select highlighted medicine and open the quantity row */
    if (event.key === 'Enter') {
      event.preventDefault();
      const index = this.selectedSearchIndex();
      const chosen =
        index >= 0 && index < results.length ? results[index] : results[0];
      if (chosen) {
        this.selectMedicine(chosen);
      }
      return;
    }

    if (event.key === 'Escape') {
      this.searchText.set('');
      this.selectedSearchIndex.set(-1);
    }
  }

  onQuickQuantityKeydown(event: KeyboardEvent) {
    if (!this.quickAddMedicine()) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.addToBill();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeQuickAdd();
    }
  }
}

