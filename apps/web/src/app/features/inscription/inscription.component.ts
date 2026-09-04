import { Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatRadioModule } from "@angular/material/radio";
import { MatStepperModule } from "@angular/material/stepper";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { forkJoin, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { ModeTransport, Sens, VehicleLendingMode } from "@desordre/shared-types";
import type { CreatePaxInput, Event } from "@desordre/shared-types";
import { ApiService } from "../../core/services/api.service";

interface InfosForm {
  nom: FormControl<string>;
  contactEmail: FormControl<string>;
  discordHandle: FormControl<string>;
  contactTelephone: FormControl<string>;
  commentaire: FormControl<string>;
}

interface TrajetInscriptionForm {
  mode: FormControl<ModeTransport | null>;
  jour: FormControl<string>;
  heure: FormControl<string>;
  gare: FormControl<string>;
  commentaire: FormControl<string>;
}

interface VehiculeForm {
  hasVehicle: FormControl<boolean | null>;
  vehicleLendingMode: FormControl<VehicleLendingMode | null>;
  hasDrivingLicense: FormControl<boolean | null>;
  willingToDriveShuttle: FormControl<boolean | null>;
}

function creerTrajetForm(): FormGroup<TrajetInscriptionForm> {
  return new FormGroup<TrajetInscriptionForm>({
    mode: new FormControl<ModeTransport | null>(null),
    jour: new FormControl("", { nonNullable: true }),
    heure: new FormControl("", { nonNullable: true }),
    gare: new FormControl("", { nonNullable: true }),
    commentaire: new FormControl("", { nonNullable: true }),
  });
}

/**
 * Inscription en deux étapes : infos perso, puis transport (aller/retour,
 * avec le bloc véhicule/conduite qui n'apparaît que si l'un des deux se
 * fait autrement qu'en train). Rien n'est envoyé avant la toute dernière
 * étape — un pax qui abandonne en cours de route ne laisse aucune trace.
 */
@Component({
  selector: "app-inscription",
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatStepperModule,
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

  readonly Sens = Sens;
  readonly ModeTransport = ModeTransport;
  readonly VehicleLendingMode = VehicleLendingMode;

  readonly infosForm = new FormGroup<InfosForm>({
    nom: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl("", { nonNullable: true, validators: [Validators.email] }),
    discordHandle: new FormControl("", { nonNullable: true }),
    contactTelephone: new FormControl("", { nonNullable: true }),
    commentaire: new FormControl("", { nonNullable: true }),
  });

  readonly trajetForms: Record<Sens, FormGroup<TrajetInscriptionForm>> = {
    [Sens.ALLER]: creerTrajetForm(),
    [Sens.RETOUR]: creerTrajetForm(),
  };

  readonly vehiculeForm = new FormGroup<VehiculeForm>({
    hasVehicle: new FormControl<boolean | null>(null),
    vehicleLendingMode: new FormControl<VehicleLendingMode | null>(null),
    hasDrivingLicense: new FormControl<boolean | null>(null),
    willingToDriveShuttle: new FormControl<boolean | null>(null),
  });

  constructor() {
    this.api.recupererEvent(this.eventId).subscribe({
      next: (event) => this.event.set(event),
      error: () => this.erreur.set("Impossible de charger cet évènement. Vérifie le lien."),
    });
  }

  /** Le bloc véhicule/conduite n'a de sens que si l'aller ou le retour se fait autrement qu'en train. */
  afficherBlocVehicule(): boolean {
    return (
      this.concerneVehicule(this.trajetForms[Sens.ALLER].value.mode ?? null) ||
      this.concerneVehicule(this.trajetForms[Sens.RETOUR].value.mode ?? null)
    );
  }

  private concerneVehicule(mode: ModeTransport | null): boolean {
    return mode === ModeTransport.COVOITURAGE || mode === ModeTransport.AUTRE;
  }

  soumettre(): void {
    if (this.infosForm.invalid) {
      this.infosForm.markAllAsTouched();
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);

    const infos = this.infosForm.getRawValue();
    // Le bloc véhicule ne compte que s'il était affiché : sinon on n'envoie
    // pas des réponses données puis rendues obsolètes par un changement de
    // mode de transport avant l'envoi.
    const vehicule = this.afficherBlocVehicule() ? this.vehiculeForm.getRawValue() : null;

    const input: CreatePaxInput = {
      eventId: this.eventId,
      nom: infos.nom,
      contactEmail: infos.contactEmail || undefined,
      discordHandle: infos.discordHandle || undefined,
      contactTelephone: infos.contactTelephone || undefined,
      commentaire: infos.commentaire || undefined,
      hasVehicle: vehicule?.hasVehicle ?? undefined,
      vehicleLendingMode: vehicule?.vehicleLendingMode ?? undefined,
      hasDrivingLicense: vehicule?.hasDrivingLicense ?? undefined,
      willingToDriveShuttle: vehicule?.willingToDriveShuttle ?? undefined,
    };

    this.api.creerPax(input).subscribe({
      next: (resultat) => this.enregistrerTrajetsPuisRediriger(resultat.accessToken),
      error: () => {
        this.enCours.set(false);
        this.erreur.set("L'inscription a échoué, réessaie dans un instant.");
      },
    });
  }

  /**
   * Un trajet n'est envoyé que si le pax a renseigné au moins une info pour
   * ce sens. Rien renseigné = "je sais pas encore", à compléter plus tard
   * depuis "mon espace" — pas la peine de créer une ligne vide en base.
   */
  private enregistrerTrajetsPuisRediriger(token: string): void {
    const appels = ([Sens.ALLER, Sens.RETOUR] as const)
      .map((sens) => {
        const valeurs = this.trajetForms[sens].getRawValue();
        const rienRenseigne =
          !valeurs.mode && !valeurs.jour && !valeurs.heure && !valeurs.gare && !valeurs.commentaire;
        if (rienRenseigne) return null;

        return this.api
          .enregistrerMonTrajet(token, sens, {
            mode: valeurs.mode ?? undefined,
            jour: valeurs.jour || undefined,
            heure: valeurs.heure || undefined,
            gare: valeurs.gare || undefined,
            commentaire: valeurs.commentaire || undefined,
          })
          // Un trajet qui échoue à s'enregistrer ne doit pas bloquer
          // l'inscription : le pax pourra toujours le compléter ensuite.
          .pipe(catchError(() => of(null)));
      })
      .filter((appel) => appel !== null);

    if (appels.length === 0) {
      void this.router.navigate(["/mon-espace", token]);
      return;
    }

    forkJoin(appels).subscribe(() => {
      void this.router.navigate(["/mon-espace", token]);
    });
  }
}
