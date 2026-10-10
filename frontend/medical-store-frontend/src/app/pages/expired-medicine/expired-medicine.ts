import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { environment } from '../../../environments/environment';
import { MedicineService } from '../../services/medicine.service';
import { OrderService } from '../../services/order.service';
import { Medicine } from '../../models';

type TabType = 'expired' | 'outOfStock';

/* Default quantity used by the "Add to Order" action on this screen
   (one strip). It can be adjusted later from the Order Medicines page. */
const DEFAULT_ORDER_QUANTITY = 10;

@Component({
  selector: 'app-expired-medicine',
  imports: [CommonModule],
  templateUrl: './expired-medicine.html',
  styleUrl: './expired-medicine.css',
})
export class ExpiredMedicine implements OnInit {
  private medicineService = inject(MedicineService);
  private orderService = inject(OrderService);

  // --------------------------------------------------
  // SAMPLE MEDICINE DATA
  // Replace this later with your MedicineService/API
  // --------------------------------------------------

  medicines = signal<Medicine[]>([]);
  loading = signal(false);

  /* Medicine currently being moved to the Order Medicines list —
     disables every "Add to Order" button while the request runs. */
  orderingId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadMedicines();
  }

  loadMedicines(): void {
    this.loading.set(true);

    this.medicineService.getAll().subscribe({
      next: (res) => {
        this.medicines.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  // --------------------------------------------------
  // UI STATE
  // --------------------------------------------------

  activeTab = signal<TabType>('expired');

  searchText = signal('');

  currentPage = signal(1);

  recordsPerPage = 10;

  showExportMenu = signal(false);

  // --------------------------------------------------
  // EXPIRED MEDICINES
  // --------------------------------------------------

  expiredMedicines = computed(() => {

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.medicines().filter(medicine => {

      const expiredDate = new Date(medicine.expiredDate);
      expiredDate.setHours(0, 0, 0, 0);

      return expiredDate < today;
    });
  });

  // --------------------------------------------------
  // OUT OF STOCK
  // --------------------------------------------------

  outOfStockMedicines = computed(() => {

    return this.medicines().filter(
      medicine => medicine.stockAvailable <= 0
    );
  });

  // --------------------------------------------------
  // CURRENT TAB DATA
  // --------------------------------------------------

  tabMedicines = computed(() => {

    if (this.activeTab() === 'expired') {
      return this.expiredMedicines();
    }

    return this.outOfStockMedicines();
  });

  // --------------------------------------------------
  // SEARCH
  // --------------------------------------------------

  filteredMedicines = computed(() => {

    const search = this.searchText()
      .trim()
      .toLowerCase();

    const medicines = this.tabMedicines();

    if (!search) {
      return medicines;
    }

    return medicines.filter(medicine =>
      medicine.name.toLowerCase().includes(search)
    );
  });

  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  totalPages = computed(() => {

    return Math.ceil(
      this.filteredMedicines().length /
      this.recordsPerPage
    );
  });

  paginatedMedicines = computed(() => {

    const start =
      (this.currentPage() - 1) *
      this.recordsPerPage;

    const end =
      start + this.recordsPerPage;

    return this.filteredMedicines().slice(
      start,
      end
    );
  });

  // --------------------------------------------------
  // SEARCH
  // --------------------------------------------------

  updateSearch(event: Event) {

    const input =
      event.target as HTMLInputElement;

    this.searchText.set(input.value);

    this.currentPage.set(1);
  }

  // --------------------------------------------------
  // TAB
  // --------------------------------------------------

  changeTab(tab: TabType) {

    this.activeTab.set(tab);

    this.searchText.set('');

    this.currentPage.set(1);

    this.showExportMenu.set(false);
  }

  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  goToPage(page: number) {

    if (
      page >= 1 &&
      page <= this.totalPages()
    ) {
      this.currentPage.set(page);
    }
  }

  previousPage() {

    this.goToPage(
      this.currentPage() - 1
    );
  }

  nextPage() {

    this.goToPage(
      this.currentPage() + 1
    );
  }

  // --------------------------------------------------
  // EXPORT MENU
  // --------------------------------------------------

  toggleExportMenu() {

    this.showExportMenu.update(
      value => !value
    );
  }

  // --------------------------------------------------
  // EXPORT EXCEL
  // --------------------------------------------------

  exportExcel() {
    const medicines = this.filteredMedicines();

    if (!medicines.length) {
      alert('No medicine available to export.');
      return;
    }

    const data = medicines.map((medicine, index) => ({
      'Sr.No': index + 1,
      'Medicine Name': medicine.name
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      this.activeTab() === 'expired'
        ? 'Expired Medicines'
        : 'Out Of Stock'
    );

    const filename =
      this.activeTab() === 'expired'
        ? 'expired-medicines.xlsx'
        : 'out-of-stock-medicines.xlsx';

    XLSX.writeFile(workbook, filename);

    this.showExportMenu.set(false);
  }

  // --------------------------------------------------
  // EXPORT PDF
  // --------------------------------------------------

  exportPdf() {
    const medicines = this.filteredMedicines();

    if (!medicines.length) {
      alert('No medicine available to export.');
      return;
    }

    const doc = new jsPDF();

    const title =
      this.activeTab() === 'expired'
        ? 'Expired Medicines'
        : 'Out Of Stock Medicines';

    doc.setFontSize(18);
    doc.text(title, 14, 15);

    doc.setFontSize(10);
    doc.text(
      `Generated on: ${new Date().toLocaleDateString()}`,
      14,
      22
    );

    const rows = medicines.map((medicine, index) => [
      index + 1,
      medicine.name
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Sr.No', 'Medicine Name']],
      body: rows,
      styles: {
        fontSize: 10
      }
    });

    const filename =
      this.activeTab() === 'expired'
        ? 'expired-medicines.pdf'
        : 'out-of-stock-medicines.pdf';

    doc.save(filename);

    this.showExportMenu.set(false);
  }

  // --------------------------------------------------
  // WHATSAPP
  // --------------------------------------------------

  sendToWhatsApp() {
    const medicines = this.filteredMedicines();

    if (!medicines.length) {
      alert('No medicine available.');
      return;
    }

    const title =
      this.activeTab() === 'expired'
        ? 'Expired Medicines'
        : 'Out Of Stock Medicines';

    let message = `*${title}*%0A%0A`;

    medicines.forEach((medicine, index) => {
      message += `${index + 1}. ${medicine.name}%0A`;
    });

    const whatsappUrl = `${environment.whatsappBaseUrl}/${environment.whatsappNumber}?text=${message}`;

    window.open(whatsappUrl, '_blank');

    this.showExportMenu.set(false);
  }

  // --------------------------------------------------
  // ADD TO ORDER
  // --------------------------------------------------
  /*
    Moves a medicine from this screen to the Order Medicines list:
    the order is created FIRST, then the medicine is deleted — so a
    failed order call never loses the medicine.
  */
  addToOrder(medicine: Medicine) {

    if (!medicine._id || this.orderingId()) {
      return;
    }

    this.orderingId.set(medicine._id);

    this.orderService
      .create({
        medicineName: medicine.name,
        quantity: DEFAULT_ORDER_QUANTITY,
      })
      .subscribe({
        next: () => {

          this.medicineService.remove(medicine._id!).subscribe({
            next: () => {

              /* Drop the medicine from the table. */
              this.medicines.update(list =>
                list.filter(item => item._id !== medicine._id)
              );

              /* Stay on a valid page after the row disappeared. */
              if (this.currentPage() > this.totalPages()) {
                this.currentPage.set(
                  Math.max(this.totalPages(), 1)
                );
              }

              this.orderingId.set(null);

              alert(
                `${medicine.name} added to Order Medicines (Qty: ${DEFAULT_ORDER_QUANTITY}).`
              );
            },
            error: (err) => {
              this.orderingId.set(null);
              alert(
                err?.error?.message ||
                'Failed to delete medicine.'
              );
            },
          });

        },
        error: (err) => {
          this.orderingId.set(null);
          alert(err?.error?.message || 'Failed to add order.');
        },
      });
  }

  // --------------------------------------------------
  // DATE FORMAT (YYYY/MM/DD)
  // --------------------------------------------------
  /* Treats the stored value as a calendar date and avoids any
     timezone shifting that the Date pipe could introduce. */
  formatDate(value: string | Date | undefined | null): string {

    if (!value) {
      return '';
    }

    const str =
      typeof value === 'string' ? value : value.toISOString();

    return str.split('T')[0].replace(/-/g, '/');
  }

  getEndIndex(): number {
    return Math.min(
      this.currentPage() * this.recordsPerPage,
      this.filteredMedicines().length
    );
  }
}
