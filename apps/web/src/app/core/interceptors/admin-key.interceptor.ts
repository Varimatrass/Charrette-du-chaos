import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { AdminAuthService } from "../services/admin-auth.service";

/** Ajoute la clé organisateur·ice sur tous les appels vers /admin/*. */
export const adminKeyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes("/admin/")) {
    return next(req);
  }

  const adminAuth = inject(AdminAuthService);
  const key = adminAuth.key();
  if (!key) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { "x-admin-key": key } }));
};
