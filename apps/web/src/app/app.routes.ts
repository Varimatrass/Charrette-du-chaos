import { Routes } from "@angular/router";
import { adminGuard } from "./core/guards/admin.guard";

export const routes: Routes = [
  { path: "", redirectTo: "admin", pathMatch: "full" },
  {
    path: "e/:eventId",
    loadComponent: () =>
      import("./features/event-landing/event-landing.component").then((m) => m.EventLandingComponent),
  },
  {
    path: "e/:eventId/inscription",
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
      import("./features/admin/events/admin-events.component").then((m) => m.AdminEventsComponent),
  },
  {
    path: "admin/events/:id",
    canActivate: [adminGuard],
    loadComponent: () =>
      import("./features/admin/event-detail/admin-event-detail.component").then(
        (m) => m.AdminEventDetailComponent,
      ),
  },
];
