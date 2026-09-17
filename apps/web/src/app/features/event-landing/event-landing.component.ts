import { Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import type { Event } from "@desordre/shared-types";
import { EventsApiService } from "../../core/api/events-api.service";
import { appLinks } from "../../core/app-paths";
import { extractAccessToken } from "../../core/utils/personal-link";

/**
 * Écran d'accueil d'un évènement, sans jeton requis : point d'entrée pour
 * tous les paxs. Iels choisissent ensuite entre se connecter avec leur lien
 * personnel (déjà inscrit·es) ou s'inscrire pour la première fois.
 */
@Component({
  selector: "app-event-landing",
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: "./event-landing.component.html",
  styleUrl: "./event-landing.component.scss",
})
export class EventLandingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsApi = inject(EventsApiService);

  readonly eventId = this.route.snapshot.paramMap.get("eventId")!;
  readonly event = signal<Event | null>(null);
  readonly error = signal<string | null>(null);
  readonly loginMode = signal(false);

  readonly tokenControl = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    this.eventsApi.get(this.eventId).subscribe({
      next: (event) => this.event.set(event),
      error: () => this.error.set("Impossible de charger cet évènement. Vérifie le lien."),
    });
  }

  showLogin(): void {
    this.loginMode.set(true);
  }

  cancelLogin(): void {
    this.loginMode.set(false);
    this.tokenControl.reset("");
  }

  goToRegistration(): void {
    void this.router.navigate(appLinks.registration(this.eventId));
  }

  login(): void {
    if (this.tokenControl.invalid) {
      this.tokenControl.markAsTouched();
      return;
    }
    void this.router.navigate(appLinks.mySpace(extractAccessToken(this.tokenControl.value)));
  }
}
