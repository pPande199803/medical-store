import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'allMedicine',
        pathMatch: 'full'
    },
    {
        path: 'allMedicine',
        loadComponent: () => import('./pages/all-medicine/all-medicine').then(m => m.AllMedicine),
        canActivate: [authGuard]
    },
    {
        path: 'login',
        loadComponent: () => import('./components/auth/login/login').then(m => m.Login)
    }, {
        path: 'register',
        loadComponent: () => import('./components/auth/register/register').then(m => m.Register)
    },
    {
        path: 'add-medicine',
        loadComponent: () => import('./pages/add-medicine/add-medicine').then(m => m.AddMedicine),
        canActivate: [authGuard]
    },
    {
        path: 'new-bill',
        loadComponent: () => import('./pages/new-bill/new-bill').then(m => m.NewBill),
        canActivate: [authGuard]
    },
    {
        path: 'bill-history',
        loadComponent: () => import('./pages/bill-history/bill-history').then(m => m.BillHistory),
        canActivate: [authGuard]
    },
    {
        path: 'expired-medicine',
        loadComponent: () => import('./pages/expired-medicine/expired-medicine').then(m => m.ExpiredMedicine),
        canActivate: [authGuard]
    },
    {
        path: 'order-medicine',
        loadComponent: () => import('./pages/order-medicine/order-medicine').then(m => m.OrderMedicine),
        canActivate: [authGuard]
    },
    {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then(m => m.Profile),
        canActivate: [authGuard]
    },
    {
        path: '**',
        loadComponent: () => import('./auth/page-not-found/page-not-found').then(m => m.PageNotFound),
        data: {
            hideLayout: true
        }
    }
];
