import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { ADMIN_KEY_HEADER, ADMIN_URL_SEGMENT } from "../api/api-base";
import { AdminAuthService } from "../services/admin-auth.service";

/** Ajoute la clé organisateur·ice sur tous les appels vers /admin/* (sauf si déjà fournie). */
export const adminKeyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes(ADMIN_URL_SEGMENT) || req.headers.has(ADMIN_KEY_HEADER)) {
    return next(req);
  }

  const key = inject(AdminAuthService).key();
  if (!key) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [ADMIN_KEY_HEADER]: key } }));
};
