import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AdminAuthService } from "../services/admin-auth.service";

/** Si la clé organisateur·ice est refusée par l'API, on repasse par l'écran de connexion. */
export const adminUnauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        req.url.includes("/admin/") &&
        error instanceof HttpErrorResponse &&
        error.status === 401
      ) {
        adminAuth.clear();
        void router.navigate(["/admin/connexion"]);
      }
      return throwError(() => error);
    }),
  );
};
