import { Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Sidebar } from './components/layout/sidebar/sidebar';
import { Header } from './components/layout/header/header';
import { Footer } from './components/layout/footer/footer';
import { filter } from 'rxjs/internal/operators/filter';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
   isSidebarOpen = signal(false);
  isAuthPage = signal(false);

  constructor(private router: Router) {

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {

        const url = event.urlAfterRedirects;

        const hideLayout =
          url === '/login' ||
          url === '/register' ||
          this.isNotFoundRoute(url);

        this.isAuthPage.set(hideLayout);

        // Close sidebar when navigating
        this.isSidebarOpen.set(true);
      });
  }

  /*
    Route NOT found check — driven by the router config instead of a
    hardcoded list, so newly added routes (e.g. /bill-history) always
    get the sidebar + header layout automatically.
  */
  private isNotFoundRoute(url: string): boolean {

    const path = url.split('?')[0].replace(/^\//, '');

    const isKnown = this.router.config.some((route) => {

      if (!route.path || route.path === '**') {
        return false;
      }

      if (route.path === '') {
        return path === '';
      }

      return path === route.path || path.startsWith(route.path + '/');
    });

    return !isKnown;
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(
      value => !value
    );
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }
}
