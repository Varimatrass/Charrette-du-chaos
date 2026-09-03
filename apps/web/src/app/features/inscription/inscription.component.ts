import { Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import type { Event } from "@desordre/shared-types";
import { ApiService } from "../../core/services/api.service";

interface InscriptionForm {
  nom: FormControl<string>;
  contactEmail: FormControl<string>;
  contactTelephone: FormControl<string>;
  commentaire: FormControl<string>;
}

@Component({
  selector: "app-inscription",
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: "./inscription.component.html",
  styleUrl: "./inscription.component.scss",
})
export class InscriptionComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  readonly eventId = this.route.snapshot.paramMap.get("eventId")!;
  readonly event = signal<Event | null>(null);
  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly form = new FormGroup<InscriptionForm>({
    nom: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl("", { nonNullable: true, validators: [Validators.email] }),
    contactTelephone: new FormControl("", { nonNullable: true }),
    commentaire: new FormControl("", { nonNullable: true }),
  });

  constructor() {
    this.api.recupererEvent(this.eventId).subscribe({
      next: (event) => this.event.set(event),
      error: () => this.erreur.set("Impossible de charger cet évènement. Vérifie le lien."),
    });
  }

  soumettre(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);
    const valeurs = this.form.getRawValue();

    this.api
      .creerPax({
        eventId: this.eventId,
        nom: valeurs.nom,
        contactEmail: valeurs.contactEmail || undefined,
        contactTelephone: valeurs.contactTelephone || undefined,
        commentaire: valeurs.commentaire || undefined,
      })
      .subscribe({
        next: (resultat) => {
          void this.router.navigate(["/mon-espace", resultat.accessToken]);
        },
        error: () => {
          this.enCours.set(false);
          this.erreur.set("L'inscription a échoué, réessaie dans un instant.");
        },
      });
  }
}
