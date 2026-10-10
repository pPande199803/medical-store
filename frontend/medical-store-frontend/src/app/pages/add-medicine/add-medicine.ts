import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { MedicineService } from '../../services/medicine.service';
import { Medicine } from '../../models';

@Component({
  selector: 'app-add-medicine',
  imports: [ReactiveFormsModule],
  templateUrl: './add-medicine.html',
  styleUrl: './add-medicine.css',
})
export class AddMedicine implements OnInit {

  // Assuming 1 strip contains 10 medicines
  medicinesPerStrip = 10;

  medicines = signal<Medicine[]>([]);

  excelFileName = signal('');
  uploadMessage = signal('');
  uploadError = signal('');
  saving = signal(false);

  /* Set when opened from All Medicine → Edit (?id=...). */
  editId = signal<string | null>(null);
  loadingEdit = signal(false);

  private medicineService = inject(MedicineService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  medicineForm = this.fb.group({
    name: ['', Validators.required],
    perMedicinePrice: [null as number | null, [
      Validators.required,
      Validators.min(0.01)
    ]],
    stripPrice: [null as number | null, [
      Validators.required,
      Validators.min(0.01)
    ]],
    boxNumber: ['', Validators.required],
    stockAvailable: [null as number | null, [
      Validators.required,
      Validators.min(0)
    ]],
    expiredDate: ['', Validators.required]
  });


  /* -----------------------------------
     EDIT MODE — opened with ?id=<medicineId>
     from the All Medicine page.
     ----------------------------------- */
  ngOnInit(): void {

    this.route.queryParamMap.subscribe((params) => {

      const id = params.get('id');

      if (id) {
        this.loadForEdit(id);
      }
    });
  }

  private loadForEdit(id: string): void {

    this.editId.set(id);
    this.loadingEdit.set(true);
    this.uploadMessage.set('');
    this.uploadError.set('');

    this.medicineService.getById(id).subscribe({
      next: (res) => {

        const m = res.data;

        this.medicineForm.patchValue({
          name: m.name,
          perMedicinePrice: Number(m.perMedicinePrice),
          stripPrice: Number(m.stripPrice),
          boxNumber: String(m.boxNumber ?? ''),
          stockAvailable: Number(m.stockAvailable),
          expiredDate: this.toDateString(m.expiredDate),
        });

        this.loadingEdit.set(false);
      },
      error: (err) => {

        this.loadingEdit.set(false);
        this.uploadError.set(
          err?.error?.message || 'Failed to load medicine details.'
        );
      },
    });
  }

  /* Back button while editing. */
  cancelEdit(): void {
    this.router.navigate(['/allMedicine']);
  }



  // -----------------------------------
  // Per Medicine Price -> Strip Price
  // -----------------------------------

  onPerMedicinePriceChange() {

    const price =
      this.medicineForm.controls.perMedicinePrice.value;

    if (price !== null && price > 0) {

      const stripPrice =
        price * this.medicinesPerStrip;

      this.medicineForm.controls.stripPrice.setValue(
        Number(stripPrice.toFixed(2)),
        { emitEvent: false }
      );
    }
  }

  // -----------------------------------
  // Strip Price -> Per Medicine Price
  // -----------------------------------

  onStripPriceChange() {

    const stripPrice =
      this.medicineForm.controls.stripPrice.value;

    if (stripPrice !== null && stripPrice > 0) {

      const perMedicinePrice =
        stripPrice / this.medicinesPerStrip;

      this.medicineForm.controls.perMedicinePrice.setValue(
        Number(perMedicinePrice.toFixed(2)),
        { emitEvent: false }
      );
    }
  }

  // -----------------------------------
  // Save Medicine
  // -----------------------------------

  addMedicine() {

    if (this.medicineForm.invalid) {

      this.medicineForm.markAllAsTouched();

      return;
    }

    const formValue = this.medicineForm.getRawValue();

    const stock = Number(formValue.stockAvailable);

    const payload: Partial<Medicine> = {
      name: formValue.name!,
      perMedicinePrice: Number(formValue.perMedicinePrice),
      stripPrice: Number(formValue.stripPrice),
      boxNumber: Number(formValue.boxNumber),
      stockAvailable: stock,
      expiredDate: formValue.expiredDate!,
    };

    this.saving.set(true);
    this.uploadMessage.set('');
    this.uploadError.set('');

    const editId = this.editId();

    /* Editing an existing medicine → PUT, otherwise POST.
       (POST increments the stock when the medicine already exists,
        so no duplicate row is ever created.) */
    const request = editId
      ? this.medicineService.update(editId, payload)
      : this.medicineService.create(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);

        // Edit finished — return to the All Medicine list.
        if (editId) {
          this.router.navigate(['/allMedicine']);
          return;
        }

        // New medicine — replace-or-append so an existing (incremented)
        // medicine is never listed twice.
        this.medicines.update((data) => {

          const index = data.findIndex((m) => m._id === res.data?._id);

          if (index >= 0) {
            const copy = [...data];
            copy[index] = res.data;
            return copy;
          }

          return [...data, res.data];
        });

        this.medicineForm.reset();
        this.uploadMessage.set(res.message || 'Medicine added successfully.');

        setTimeout(() => this.uploadMessage.set(''), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.uploadError.set(
          err?.error?.message || 'Failed to save medicine.'
        );
      },
    });
  }

  // -----------------------------------
  // Download Excel Template
  // -----------------------------------

  downloadExcelTemplate() {

    const data = [
      {
        'Medicine Name': 'Paracetamol 500mg',
        'Per Medicine Price': 2,
        '1 Strip Price': 20,
        'Box Number': 'BX-1001',
        'Stock Available': 100,
        'In-Stock': 'Yes',
        'Expired Date': '2027-04-12'
      }
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(data);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Medicines'
    );

    XLSX.writeFile(
      workbook,
      'medical-store-medicine-template.xlsx'
    );
  }

  // -----------------------------------
  // Upload Excel
  // -----------------------------------

  onExcelUpload(event: Event) {

    const input =
      event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    this.excelFileName.set(file.name);

    this.uploadMessage.set('');
    this.uploadError.set('');

    const reader = new FileReader();

    reader.onload = (e: any) => {

      try {

        const data = new Uint8Array(e.target.result);

        const workbook =
          XLSX.read(data, {
            type: 'array'
          });

        const sheetName =
          workbook.SheetNames[0];

        const worksheet =
          workbook.Sheets[sheetName];

        const rows: any[] =
          XLSX.utils.sheet_to_json(
            worksheet,
            {
              defval: '',
              cellDates: true
            } as any
          );

        if (rows.length === 0) {

          this.uploadError.set(
            'Excel file is empty.'
          );

          return;
        }

        // Build clean payloads, skipping rows that are missing required data.
        const payloads = rows
          .map((row) => this.mapRowToPayload(row))
          .filter((p): p is Partial<Medicine> => p !== null);

        if (payloads.length === 0) {
          this.uploadError.set(
            'No valid rows found. Please check the column headers match the template.'
          );
          input.value = '';
          return;
        }

        this.saving.set(true);

        /* Send every medicine to the API under the logged-in user.
           A single duplicate/invalid row must not stop the rest, so each
           request handles its own error and we tally the results. */
        const requests = payloads.map((payload) =>
          this.medicineService.create(payload).pipe(
            map((res) => ({ ok: true, data: res.data })),
            catchError((err) =>
              of({
                ok: false,
                data: payload,
                message: err?.error?.message || 'Failed to save'
              })
            )
          )
        );

        forkJoin(requests)
          .pipe(
            finalize(() => {
              this.saving.set(false);
              input.value = '';
            })
          )
          .subscribe((results: any[]) => {
            const saved = results
              .filter((r) => r.ok)
              .map((r) => r.data as Medicine);

            const failed = results.filter((r) => !r.ok);

            if (saved.length > 0) {

              // Replace-or-append so an existing medicine whose stock was
              // incremented (instead of duplicated) is never listed twice.
              this.medicines.update((existing) => {

                const copy = [...existing];

                saved.forEach((m) => {
                  const i = copy.findIndex((x) => x._id === m._id);

                  if (i >= 0) {
                    copy[i] = m;
                  } else {
                    copy.push(m);
                  }
                });

                return copy;
              });

              this.uploadMessage.set(
                `${saved.length} medicine(s) saved to database` +
                ` (existing medicine names get quantity increased, no duplicates).` +
                (failed.length
                  ? ` ${failed.length} row(s) skipped (invalid data).`
                  : '')
              );
            } else {
              this.uploadError.set(
                `No medicines were saved. ${failed.length} row(s) skipped (invalid data).`
              );
            }
          });

      } catch (error) {

        console.error(error);

        this.uploadError.set(
          'Unable to read the Excel file. Please check the format.'
        );
      }
    };

    reader.readAsArrayBuffer(file);
  }

  /* -----------------------------------
     Map one Excel row to a clean API payload.
     Returns null when required data is missing so the row is skipped.
     ----------------------------------- */
  private mapRowToPayload(row: any): Partial<Medicine> | null {

    const name = String(row['Medicine Name'] ?? '').trim();
    const perMedicinePrice = Number(row['Per Medicine Price']);

    let stripPrice = Number(row['1 Strip Price']);
    const stock = Number(row['Stock Available']);
    const boxNumber = Number(row['Box Number']);
    const expiredDate = this.toDateString(row['Expired Date']);

    // Required fields — skip the row if any are missing/invalid.
    if (!name) return null;
    if (!Number.isFinite(perMedicinePrice) || perMedicinePrice <= 0) return null;
    if (!Number.isFinite(stock) || stock < 0) return null;
    if (!expiredDate) return null;

    // Derive the strip price when it is missing or zero.
    if (!Number.isFinite(stripPrice) || stripPrice <= 0) {
      stripPrice = perMedicinePrice * this.medicinesPerStrip;
    }

    return {
      name,
      perMedicinePrice,
      stripPrice,
      boxNumber: Number.isFinite(boxNumber) ? boxNumber : 0,
      stockAvailable: stock,
      expiredDate,
    };
  }

  /* -----------------------------------
     Convert an Excel cell (Date, serial number, or string) to YYYY-MM-DD.
     ----------------------------------- */
  private toDateString(value: any): string {

    if (value === null || value === undefined || value === '') {
      return '';
    }

    // Already a JS Date (when cellDates parsing works)
    if (value instanceof Date && !isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Excel serial date number (e.g. 46466) — convert using UTC to avoid shifts.
    // 25569 = days between the Excel epoch (1900) and the Unix epoch (1970).
    if (typeof value === 'number' && value > 1 && value < 100000) {
      const ms = Math.round((Math.floor(value) - 25569) * 86400 * 1000);
      const d = new Date(ms);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Plain string — handle ISO datetime from MongoDB (e.g. 2027-03-20T00:00:00.000Z)
    const str = String(value).trim();

    if (str.includes('T')) {
      return str.split('T')[0];
    }

    return str;
  }

  toggleStripQuantity() {
    this.medicinesPerStrip =
      this.medicinesPerStrip === 10 ? 15 : 10;
  }
}
