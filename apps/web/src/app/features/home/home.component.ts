import { Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import type { EventWithStations } from "@desordre/shared-types";
import { EventsApiService } from "../../core/api/events-api.service";
import { appLinks } from "../../core/app-paths";
import { AdminAuthService } from "../../core/services/admin-auth.service";
import { extractAccessToken } from "../../core/utils/personal-link";

/**
 * Page d'accueil : un pax se connecte avec son code personnel (plus tard
 * aussi par SSO), s'inscrit à un évènement ouvert, ou l'orga rejoint son
 * espace. C'est aussi là qu'atterrit toute URL inconnue.
 */
@Component({
  selector: "app-home",
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.scss",
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly eventsApi = inject(EventsApiService);
  private readonly adminAuth = inject(AdminAuthService);

  readonly openEvents = signal<EventWithStations[]>([]);
  readonly registrationLink = appLinks.registration;
  readonly adminLink = this.adminAuth.isAuthenticated ? appLinks.admin() : appLinks.adminLogin();

  readonly tokenControl = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    this.eventsApi.listOpen().subscribe({
      next: (events) => this.openEvents.set(events),
      error: () => this.openEvents.set([]),
    });
  }

  login(): void {
    if (this.tokenControl.invalid) {
      this.tokenControl.markAsTouched();
      return;
    }
    void this.router.navigate(appLinks.mySpace(extractAccessToken(this.tokenControl.value)));
  }
}
