import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MedicineService } from '../../services/medicine.service';
import { Medicine } from '../../models';

@Component({
  selector: 'app-all-medicine',
  imports: [FormsModule],
  templateUrl: './all-medicine.html',
  styleUrl: './all-medicine.css',
})
export class AllMedicine implements OnInit {
  private medicineService = inject(MedicineService);
  private router = inject(Router);

  searchText = signal('');
  currentPage = signal(1);
  loading = signal(false);

  /* Id of the row whose Delete button is waiting for confirmation. */
  pendingDeleteId = signal<string | null>(null);

  pageSize = 10;

  medicines = signal<Medicine[]>([]);

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

  filteredMedicines = computed(() => {
    const search = this.searchText().trim().toLowerCase();

    if (!search) {
      return this.medicines();
    }

    return this.medicines().filter((medicine) =>
      medicine.name.toLowerCase().includes(search)
    );
  });

  totalPages = computed(() =>
    Math.ceil(this.filteredMedicines().length / this.pageSize)
  );

  paginatedMedicines = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;

    return this.filteredMedicines().slice(start, start + this.pageSize);
  });

  pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, index) => index + 1)
  );

  onSearch() {
    this.currentPage.set(1);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  previousPage() {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }

  isExpired(date: string): boolean {
    return new Date(date) < new Date();
  }

  /* -----------------------------------
     EDIT — open the Add Medicine page
     prefilled with this medicine so the
     user can update it there.
     ----------------------------------- */
  editMedicine(medicine: Medicine): void {

    if (!medicine._id) {
      return;
    }

    this.router.navigate(['/add-medicine'], {
      queryParams: { id: medicine._id },
    });
  }

  /* -----------------------------------
     DELETE — two-step confirm:
     1st click arms the row, 2nd click deletes.
     ----------------------------------- */
  requestDelete(medicine: Medicine): void {

    if (!medicine._id) {
      return;
    }

    if (this.pendingDeleteId() === medicine._id) {
      this.deleteMedicine(medicine._id);
      return;
    }

    this.pendingDeleteId.set(medicine._id);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  private deleteMedicine(id: string): void {

    this.medicineService.remove(id).subscribe({
      next: () => {
        this.pendingDeleteId.set(null);
        this.loadMedicines();
      },
      error: (err) => {
        this.pendingDeleteId.set(null);
        alert(err?.error?.message || 'Failed to delete medicine');
      },
    });
  }

  /* Format a stored date as YYYY/MM/DD (timezone safe). */
  formatDate(date: string | Date | undefined | null): string {
    if (!date) {
      return '';
    }

    const str = typeof date === 'string' ? date : date.toISOString();
    return str.split('T')[0].replace(/-/g, '/');
  }

  getEndIndex(): number {
    return Math.min(
      this.currentPage() * this.pageSize,
      this.filteredMedicines().length
    );
  }
}
