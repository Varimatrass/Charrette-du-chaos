import { Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import type { Event } from "@desordre/shared-types";
import { ApiService } from "../../core/services/api.service";

/**
 * Écran d'accueil d'un évènement, sans jeton requis : point d'entrée pour
 * tous les paxs. Iels choisissent ensuite entre se connecter avec leur lien
 * personnel (déjà inscrit·es) ou s'inscrire pour la première fois.
 */
@Component({
  selector: "app-event-landing",
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: "./event-landing.component.html",
  styleUrl: "./event-landing.component.scss",
})
export class EventLandingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  readonly eventId = this.route.snapshot.paramMap.get("eventId")!;
  readonly event = signal<Event | null>(null);
  readonly erreur = signal<string | null>(null);
  readonly modeConnexion = signal(false);

  readonly tokenControl = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    this.api.recupererEvent(this.eventId).subscribe({
      next: (event) => this.event.set(event),
      error: () => this.erreur.set("Impossible de charger cet évènement. Vérifie le lien."),
    });
  }

  afficherConnexion(): void {
    this.modeConnexion.set(true);
  }

  annulerConnexion(): void {
    this.modeConnexion.set(false);
    this.tokenControl.reset("");
  }

  allerInscription(): void {
    void this.router.navigate(["/e", this.eventId, "inscription"]);
  }

  seConnecter(): void {
    if (this.tokenControl.invalid) {
      this.tokenControl.markAsTouched();
      return;
    }
    void this.router.navigate(["/mon-espace", this.extraireToken(this.tokenControl.value)]);
  }

  /**
   * Certain·es collent le lien personnel complet (copié depuis un message)
   * plutôt que juste le jeton : on récupère le jeton dans les deux cas.
   */
  private extraireToken(saisie: string): string {
    const valeur = saisie.trim();
    const correspondance = valeur.match(/\/mon-espace\/([^/\s?#]+)/);
    return correspondance ? correspondance[1] : valeur;
  }
}
