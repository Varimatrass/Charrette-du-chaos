import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { appLinks } from "../app-paths";
import { AdminAuthService } from "../services/admin-auth.service";

/** Les écrans du back-office exigent une clé organisateur·ice mémorisée. */
export const adminGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  return adminAuth.isAuthenticated ? true : router.createUrlTree(appLinks.adminLogin());
};
