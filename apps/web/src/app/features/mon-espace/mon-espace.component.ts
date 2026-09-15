import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from "@angular/forms";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTableModule } from "@angular/material/table";
import { DatePipe } from "@angular/common";
import { ModeTransport, Sens, StatutTrajet, VehicleLendingMode } from "@desordre/shared-types";
import type {
  DriverAvailabilitySlot,
  NavetteAvecNomsPassagers,
  PassagerNom,
  PaxOverview,
  TrajetOverview,
} from "@desordre/shared-types";
import { ApiService, PaxAvecTrajets } from "../../core/services/api.service";

interface TrajetFormGroup {
  mode: FormControl<ModeTransport>;
  jour: FormControl<string>;
  heure: FormControl<string>;
  gare: FormControl<string>;
  commentaire: FormControl<string>;
}

function creerTrajetForm(): FormGroup<TrajetFormGroup> {
  return new FormGroup<TrajetFormGroup>({
    mode: new FormControl(ModeTransport.TRAIN, { nonNullable: true, validators: [Validators.required] }),
    jour: new FormControl("", { nonNullable: true }),
    heure: new FormControl("", { nonNullable: true }),
    gare: new FormControl("", { nonNullable: true }),
    commentaire: new FormControl("", { nonNullable: true }),
  });
}

@Component({
  selector: "app-mon-espace",
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: "./mon-espace.component.html",
  styleUrl: "./mon-espace.component.scss",
})
export class MonEspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly Sens = Sens;
  readonly ModeTransport = ModeTransport;
  readonly StatutTrajet = StatutTrajet;

  readonly token = this.route.snapshot.paramMap.get("token")!;
  readonly lienPersonnel = window.location.href;

  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly pax = signal<PaxAvecTrajets | null>(null);
  readonly enregistrementInfos = signal(false);
  readonly enregistrementTrajet = signal<Sens | null>(null);

  readonly navettes = signal<NavetteAvecNomsPassagers[]>([]);
  readonly colonnesNavettes = ["libelle", "sens", "jour", "heures", "conducteur", "places", "passagers"];

  readonly paxsEvenement = signal<PaxOverview[]>([]);
  readonly colonnesPaxs = ["nom", "discord", "vehicule", "commentaire"];

  readonly trajetsEvenement = signal<TrajetOverview[]>([]);
  readonly colonnesTrajets = ["pax", "sens", "mode", "quand", "statut", "navette"];

  readonly mesDisponibilites = signal<DriverAvailabilitySlot[]>([]);
  readonly enregistrementDisponibilite = signal(false);

  readonly disponibiliteForm = new FormGroup({
    day: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    startTime: new FormControl("", { nonNullable: true }),
    endTime: new FormControl("", { nonNullable: true }),
    comment: new FormControl("", { nonNullable: true }),
  });

  readonly infosForm = new FormGroup({
    nom: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl("", { nonNullable: true, validators: [Validators.email] }),
    discordHandle: new FormControl("", { nonNullable: true }),
    contactTelephone: new FormControl("", { nonNullable: true }),
    commentaire: new FormControl("", { nonNullable: true }),
  });

  readonly trajetForms: Record<Sens, FormGroup<TrajetFormGroup>> = {
    [Sens.ALLER]: creerTrajetForm(),
    [Sens.RETOUR]: creerTrajetForm(),
  };

  constructor() {
    this.charger();
  }

  private charger(): void {
    this.chargement.set(true);
    this.api.recupererMonEspace(this.token).subscribe({
      next: (pax) => {
        this.pax.set(pax);
        this.infosForm.patchValue({
          nom: pax.nom,
          contactEmail: pax.contactEmail ?? "",
          discordHandle: pax.discordHandle ?? "",
          contactTelephone: pax.contactTelephone ?? "",
          commentaire: pax.commentaire ?? "",
        });

        for (const sens of [Sens.ALLER, Sens.RETOUR]) {
          const trajet = pax.trajets.find((t) => t.sens === sens);
          if (trajet) {
            this.trajetForms[sens].patchValue({
              // Le mode peut être `null` en base ("pas encore décidé") ; le
              // formulaire actuel n'a pas encore cette option, on retombe
              // sur Train par défaut en attendant la Phase 2 du parcours pax.
              mode: trajet.mode ?? ModeTransport.TRAIN,
              jour: trajet.jour ? trajet.jour.substring(0, 10) : "",
              heure: trajet.heure ?? "",
              gare: trajet.gare ?? "",
              commentaire: trajet.commentaire ?? "",
            });
          }
        }

        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set("Ce lien personnel n'est plus valide. Contacte l'organisation pour le retrouver.");
      },
    });

    // Planning des navettes, annuaire des paxs et vue d'ensemble des trajets :
    // trois chargements indépendants du reste, une erreur sur l'un d'eux ne
    // doit pas empêcher d'afficher/modifier ses propres infos et trajets.
    this.api.listerNavettesMonEvent(this.token).subscribe({
      next: (navettes) => this.navettes.set(navettes),
      error: () => this.navettes.set([]),
    });

    this.api.listerPaxsMonEvent(this.token).subscribe({
      next: (paxs) => this.paxsEvenement.set(paxs),
      error: () => this.paxsEvenement.set([]),
    });

    this.api.listerTrajetsMonEvent(this.token).subscribe({
      next: (trajets) => this.trajetsEvenement.set(trajets),
      error: () => this.trajetsEvenement.set([]),
    });

    this.chargerMesDisponibilites();
  }

  private chargerMesDisponibilites(): void {
    this.api.listerMesDisponibilites(this.token).subscribe({
      next: (slots) => this.mesDisponibilites.set(slots),
      error: () => this.mesDisponibilites.set([]),
    });
  }

  navetteAssignee(sens: Sens) {
    return this.pax()?.trajets.find((t) => t.sens === sens)?.navette ?? null;
  }

  /** Pour surligner dans le planning la ou les navettes déjà assignées à ce pax. */
  estMaNavette(navetteId: string): boolean {
    return (this.pax()?.trajets ?? []).some((t) => t.navette?.id === navetteId);
  }

  nomsPassagers(passagers: PassagerNom[]): string {
    return passagers.map((p) => p.nom).join(", ");
  }

  /** Résumé lisible du bloc véhicule/conduite d'un pax pour l'annuaire. */
  vehiculeResume(p: PaxOverview): string {
    if (p.hasVehicle === true) {
      const parts: string[] = ["a une voiture"];
      if (p.vehicleLendingMode === VehicleLendingMode.AVAILABLE_ANY_DRIVER) {
        parts.push("prête même si iel ne conduit pas");
      } else if (p.vehicleLendingMode === VehicleLendingMode.ONLY_IF_OWNER_DRIVES) {
        parts.push("prête seulement si iel conduit");
      }
      if (p.willingToDriveShuttle) parts.push("partant·e pour conduire");
      return parts.join(", ");
    }
    if (p.hasVehicle === false) {
      const parts: string[] = [];
      if (p.hasDrivingLicense) parts.push("a le permis");
      if (p.willingToDriveShuttle) parts.push("partant·e pour conduire");
      return parts.length > 0 ? parts.join(", ") : "—";
    }
    return "—";
  }

  libelleMode(mode: ModeTransport | null): string {
    switch (mode) {
      case ModeTransport.TRAIN:
        return "Train";
      case ModeTransport.COVOITURAGE:
        return "Covoiturage";
      case ModeTransport.AUTRE:
        return "Autre";
      default:
        return "?";
    }
  }

  libelleStatut(statut: StatutTrajet): string {
    switch (statut) {
      case StatutTrajet.ASSIGNE:
        return "Assigné";
      case StatutTrajet.A_REVERIFIER:
        return "À revérifier";
      default:
        return "En attente";
    }
  }

  statutTrajet(sens: Sens): StatutTrajet | null {
    return this.pax()?.trajets.find((t) => t.sens === sens)?.statut ?? null;
  }

  copierLePersonnel(): void {
    void navigator.clipboard.writeText(this.lienPersonnel);
    this.snackBar.open("Lien copié !", undefined, { duration: 2000 });
  }

  enregistrerInfos(): void {
    if (this.infosForm.invalid) {
      this.infosForm.markAllAsTouched();
      return;
    }
    this.enregistrementInfos.set(true);
    this.api.modifierMesInfos(this.token, this.infosForm.getRawValue()).subscribe({
      next: () => {
        this.enregistrementInfos.set(false);
        this.snackBar.open("Tes infos ont été enregistrées.", undefined, { duration: 2500 });
      },
      error: () => {
        this.enregistrementInfos.set(false);
        this.snackBar.open("Échec de l'enregistrement, réessaie.", undefined, { duration: 3000 });
      },
    });
  }

  ajouterDisponibilite(): void {
    if (this.disponibiliteForm.invalid) {
      this.disponibiliteForm.markAllAsTouched();
      return;
    }
    const valeurs = this.disponibiliteForm.getRawValue();
    this.enregistrementDisponibilite.set(true);
    this.api
      .ajouterMaDisponibilite(this.token, {
        day: valeurs.day,
        startTime: valeurs.startTime || undefined,
        endTime: valeurs.endTime || undefined,
        comment: valeurs.comment || undefined,
      })
      .subscribe({
        next: () => {
          this.enregistrementDisponibilite.set(false);
          this.disponibiliteForm.reset({ day: "", startTime: "", endTime: "", comment: "" });
          this.snackBar.open("Créneau ajouté.", undefined, { duration: 2000 });
          this.chargerMesDisponibilites();
        },
        error: () => {
          this.enregistrementDisponibilite.set(false);
          this.snackBar.open("Échec de l'ajout, réessaie.", undefined, { duration: 3000 });
        },
      });
  }

  supprimerDisponibilite(id: string): void {
    this.api.supprimerMaDisponibilite(this.token, id).subscribe({
      next: () => {
        this.snackBar.open("Créneau supprimé.", undefined, { duration: 2000 });
        this.chargerMesDisponibilites();
      },
      error: () => this.snackBar.open("Échec de la suppression, réessaie.", undefined, { duration: 3000 }),
    });
  }

  enregistrerTrajet(sens: Sens): void {
    const form = this.trajetForms[sens];
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.enregistrementTrajet.set(sens);
    const valeurs = form.getRawValue();

    this.api
      .enregistrerMonTrajet(this.token, sens, {
        mode: valeurs.mode,
        jour: valeurs.jour || undefined,
        heure: valeurs.heure || undefined,
        gare: valeurs.gare || undefined,
        commentaire: valeurs.commentaire || undefined,
      })
      .subscribe({
        next: () => {
          this.enregistrementTrajet.set(null);
          this.snackBar.open("Trajet enregistré.", undefined, { duration: 2500 });
          this.charger();
        },
        error: () => {
          this.enregistrementTrajet.set(null);
          this.snackBar.open("Échec de l'enregistrement, réessaie.", undefined, { duration: 3000 });
        },
      });
  }
}
