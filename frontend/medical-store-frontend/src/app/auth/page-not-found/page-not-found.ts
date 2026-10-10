import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-page-not-found',
  imports: [],
  templateUrl: './page-not-found.html',
  styleUrl: './page-not-found.css',
})
export class PageNotFound {
  constructor(private router: Router) { }

  goToHome(): void {
    this.router.navigate(['/medicines']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
