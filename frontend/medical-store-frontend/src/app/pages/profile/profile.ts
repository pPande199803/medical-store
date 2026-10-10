import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { MedicineService } from '../../services/medicine.service';
import { User } from '../../models';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private auth = inject(AuthService);
  private medicineService = inject(MedicineService);
  private fb = inject(FormBuilder);

  user = signal<User | null>(null);

  isEditing = signal(false);
  loading = signal(true);
  saving = signal(false);
  message = signal('');
  messageType = signal<'success' | 'error'>('success');

  logoPreview = signal<string | null>(null);

  totalMedicines = signal(0);
  inStockCount = signal(0);
  lowStockCount = signal(0);

  profileForm = this.fb.group({
    medicalName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    address: [''],
    logo: [''],
    password: ['', [Validators.minLength(6)]],
  });

  ngOnInit(): void {
    this.loadProfile();
    this.loadStats();
  }

  loadProfile(): void {
    this.loading.set(true);

    this.auth.me().subscribe({
      next: (res) => {
        this.user.set(res.data);
        this.logoPreview.set(res.data.logo || null);
        this.patchForm(res.data);
        this.loading.set(false);
      },
      error: () => {
        // Fallback to locally cached user if the request fails.
        const cached = this.auth.currentUser();
        if (cached) {
          this.user.set(cached);
          this.logoPreview.set(cached.logo || null);
          this.patchForm(cached);
        }
        this.loading.set(false);
      },
    });
  }

  loadStats(): void {
    this.medicineService.getAll().subscribe({
      next: (res) => {
        const meds = res.data || [];
        this.totalMedicines.set(meds.length);
        this.inStockCount.set(meds.filter((m) => m.stockAvailable > 0).length);
        this.lowStockCount.set(
          meds.filter((m) => m.stockAvailable > 0 && m.stockAvailable <= 10).length
        );
      },
      error: () => {
        /* stats are optional; ignore errors */
      },
    });
  }

  private patchForm(user: User): void {
    this.profileForm.patchValue({
      medicalName: user.medicalName || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      logo: user.logo || '',
      password: '',
    });
  }

  startEdit(): void {
    this.isEditing.set(true);
    this.message.set('');
    this.patchForm(this.user() as User);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.message.set('');
    this.logoPreview.set(this.user()?.logo || null);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.showMessage('Please select a valid image.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.logoPreview.set(result);
      this.profileForm.controls.logo.setValue(result);
    };
    reader.readAsDataURL(file);
  }

  save(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.message.set('');

    const value = this.profileForm.getRawValue();

    // Only send the password field when the user actually typed one.
    const payload: Partial<User> & { password?: string } = {
      medicalName: value.medicalName || '',
      email: value.email || '',
      phone: value.phone || '',
      address: value.address || '',
      logo: value.logo || '',
    };

    if (value.password && value.password.trim().length > 0) {
      payload.password = value.password;
    }

    this.auth.updateProfile(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.isEditing.set(false);
        this.user.set(res.data);
        this.logoPreview.set(res.data.logo || null);
        this.profileForm.controls.password.setValue('');
        this.showMessage('Profile updated successfully!', 'success');
      },
      error: (err) => {
        this.saving.set(false);
        this.showMessage(
          err?.error?.message || 'Failed to update profile.',
          'error'
        );
      },
    });
  }

  private showMessage(text: string, type: 'success' | 'error'): void {
    this.message.set(text);
    this.messageType.set(type);
  }
}
