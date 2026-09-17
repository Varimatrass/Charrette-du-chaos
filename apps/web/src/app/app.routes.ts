import { Routes } from "@angular/router";
import { APP_PATHS } from "./core/app-paths";
import { adminGuard } from "./core/guards/admin.guard";

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () => import("./features/home/home.component").then((m) => m.HomeComponent),
  },
  {
    path: `${APP_PATHS.eventLanding}/:eventId`,
    loadComponent: () =>
      import("./features/event-landing/event-landing.component").then(
        (m) => m.EventLandingComponent,
      ),
  },
  {
    path: `${APP_PATHS.eventLanding}/:eventId/${APP_PATHS.registration}`,
    loadComponent: () =>
      import("./features/registration/registration.component").then((m) => m.RegistrationComponent),
  },
  {
    path: `${APP_PATHS.mySpace}/:token`,
    loadComponent: () =>
      import("./features/pax/pax-shell.component").then((m) => m.PaxShellComponent),
    children: [
      {
        path: "",
        pathMatch: "full",
        loadComponent: () =>
          import("./features/my-space/my-space.component").then((m) => m.MySpaceComponent),
      },
      {
        path: APP_PATHS.tables,
        loadComponent: () =>
          import("./features/pax/pax-tables.component").then((m) => m.PaxTablesComponent),
      },
    ],
  },
  {
    path: `${APP_PATHS.admin}/${APP_PATHS.adminLogin}`,
    loadComponent: () =>
      import("./features/admin/login/admin-login.component").then((m) => m.AdminLoginComponent),
  },
  {
    path: APP_PATHS.admin,
    canActivate: [adminGuard],
    loadComponent: () =>
      import("./features/admin/admin-shell.component").then((m) => m.AdminShellComponent),
    children: [
      {
        path: "",
        pathMatch: "full",
        loadComponent: () =>
          import("./features/admin/events/admin-events.component").then(
            (m) => m.AdminEventsComponent,
          ),
      },
      {
        path: `${APP_PATHS.adminEvents}/:id`,
        children: [
          { path: "", pathMatch: "full", redirectTo: APP_PATHS.adminEventPaxs },
          {
            path: APP_PATHS.adminEventConfig,
            loadComponent: () =>
              import("./features/admin/config/admin-event-config.component").then(
                (m) => m.AdminEventConfigComponent,
              ),
          },
          {
            path: APP_PATHS.adminEventPaxs,
            loadComponent: () =>
              import("./features/admin/event-detail/admin-paxs-page.component").then(
                (m) => m.AdminPaxsPageComponent,
              ),
          },
          {
            path: APP_PATHS.adminEventShuttles,
            loadComponent: () =>
              import("./features/admin/event-detail/admin-shuttles-page.component").then(
                (m) => m.AdminShuttlesPageComponent,
              ),
          },
          {
            path: APP_PATHS.adminEventTrips,
            loadComponent: () =>
              import("./features/admin/event-detail/admin-trips-page.component").then(
                (m) => m.AdminTripsPageComponent,
              ),
          },
        ],
      },
    ],
  },
  // Toute URL inconnue ramène à l'accueil.
  { path: "**", redirectTo: "" },
];
