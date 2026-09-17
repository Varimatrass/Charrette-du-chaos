import { Routes } from "@angular/router";
import { APP_PATHS } from "./core/app-paths";
import { adminGuard } from "./core/guards/admin.guard";

export const routes: Routes = [
  { path: "", redirectTo: APP_PATHS.admin, pathMatch: "full" },
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
      import("./features/my-space/my-space.component").then((m) => m.MySpaceComponent),
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
      import("./features/admin/events/admin-events.component").then((m) => m.AdminEventsComponent),
  },
  {
    path: `${APP_PATHS.admin}/${APP_PATHS.adminEvents}/:id`,
    canActivate: [adminGuard],
    loadComponent: () =>
      import("./features/admin/event-detail/admin-event-detail.component").then(
        (m) => m.AdminEventDetailComponent,
      ),
  },
];
