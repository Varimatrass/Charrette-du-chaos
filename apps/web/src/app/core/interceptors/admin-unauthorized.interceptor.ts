import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { ADMIN_URL_SEGMENT } from "../api/api-base";
import { appLinks } from "../app-paths";
import { AdminAuthService } from "../services/admin-auth.service";

/**
 * Si la clé organisateur·ice mémorisée est refusée par l'API, on l'oublie et
 * on repasse par l'écran de connexion. L'écran de connexion lui-même teste
 * une clé via /admin/auth : un 401 là-bas ne doit pas déclencher la
 * redirection (on y est déjà), d'où l'exclusion.
 */
export const adminUnauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        req.url.includes(ADMIN_URL_SEGMENT) &&
        !req.url.endsWith("/admin/auth") &&
        error instanceof HttpErrorResponse &&
        error.status === HttpStatusCode.Unauthorized
      ) {
        adminAuth.clear();
        void router.navigate(appLinks.adminLogin());
      }
      return throwError(() => error);
    }),
  );
};
