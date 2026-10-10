import { HttpInterceptorFn } from '@angular/common/http';

/*
  Attaches the stored JWT to every outgoing API request.
*/
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('medical_store_token');

  if (token && req.url.includes('/api/')) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req);
};
