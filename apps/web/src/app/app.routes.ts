import { Routes } from "@angular/router";
import { adminGuard } from "./core/guards/admin.guard";

export const routes: Routes = [
  { path: "", redirectTo: "admin", pathMatch: "full" },
  {
    path: "e/:editionId",
    loadComponent: () =>
      import("./features/inscription/inscription.component").then((m) => m.InscriptionComponent),
  },
  {
    path: "mon-espace/:token",
    loadComponent: () =>
      import("./features/mon-espace/mon-espace.component").then((m) => m.MonEspaceComponent),
  },
  {
    path: "admin/connexion",
    loadComponent: () =>
      import("./features/admin/login/admin-login.component").then((m) => m.AdminLoginComponent),
  },
  {
    path: "admin",
    canActivate: [adminGuard],
    loadComponent: () =>
      import("./features/admin/editions/admin-editions.component").then((m) => m.AdminEditionsComponent),
  },
  {
    path: "admin/editions/:id",
    canActivate: [adminGuard],
    loadComponent: () =>
      import("./features/admin/edition-detail/admin-edition-detail.component").then(
        (m) => m.AdminEditionDetailComponent,
      ),
  },
];
