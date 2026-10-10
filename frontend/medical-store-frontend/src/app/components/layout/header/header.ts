import { Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  menuClick = output<void>();
  isProfileOpen = signal(false);
  router = inject(Router);
  auth = inject(AuthService);

  user = this.auth.currentUser;

  toggleMenu() {
    this.menuClick.emit();
  }

  toggleProfile() {
    this.isProfileOpen.update(value => !value);
  }

  goToProfile() {
    this.isProfileOpen.set(false);
    this.router.navigate(['/profile']);
  }

  logout() {
    this.auth.logout();
    this.isProfileOpen.set(false);
    this.router.navigate(['/login']);
  }
}
