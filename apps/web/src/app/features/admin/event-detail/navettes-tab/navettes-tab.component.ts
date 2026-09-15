import { Component, inject, input, OnChanges, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatTableModule } from "@angular/material/table";
import { Sens } from "@desordre/shared-types";
import type { Navette, NavetteAvecPassagers, PaxAdmin } from "@desordre/shared-types";
import { ApiService } from "../../../../core/services/api.service";

@Component({
  selector: "app-navettes-tab",
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: "./navettes-tab.component.html",
  styleUrl: "./navettes-tab.component.scss",
})
export class NavettesTabComponent implements OnChanges {
  readonly eventId = input.required<string>();

  private readonly api = inject(ApiService);

  readonly Sens = Sens;
  readonly colonnes = ["libelle", "sens", "jour", "heures", "places", "actions"];
  readonly navettes = signal<(Navette & { placesRestantes: number })[]>([]);
  readonly afficherFormulaire = signal(false);
  readonly navetteOuverte = signal<NavetteAvecPassagers | null>(null);
  /** Pour le sélecteur "conducteur·ice lié·e à un pax" du formulaire. */
  readonly paxsEvent = signal<PaxAdmin[]>([]);
  /** `null` = formulaire de création ; sinon l'id de la navette en cours de modification. */
  readonly navetteEnEdition = signal<string | null>(null);

  readonly form = new FormGroup({
    libelle: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    sens: new FormControl<Sens>(Sens.ALLER, { nonNullable: true, validators: [Validators.required] }),
    jour: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    conducteur: new FormControl("", { nonNullable: true }),
    vehicule: new FormControl("", { nonNullable: true }),
    heureDepart: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    heureArriveeGare: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    heureRetourLieu: new FormControl("", { nonNullable: true }),
    capacite: new FormControl(4, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    commentaire: new FormControl("", { nonNullable: true }),
    driverPaxId: new FormControl("", { nonNullable: true }),
  });

  ngOnChanges(): void {
    this.charger();
    this.api.listerPaxsEvent(this.eventId()).subscribe((paxs) => this.paxsEvent.set(paxs));
  }

  charger(): void {
    this.api.listerNavettes(this.eventId()).subscribe((navettes) => this.navettes.set(navettes));
  }

  /**
   * Quand l'admin choisit un pax dans le sélecteur, on pré-remplit le champ
   * texte "conducteur" avec son nom, par confort — mais il reste éditable
   * librement ensuite (ex: pour préciser "Sophie (voiture rouge)").
   */
  surSelectionConducteur(paxId: string): void {
    const pax = this.paxsEvent().find((p) => p.id === paxId);
    if (pax && !this.form.controls.conducteur.value) {
      this.form.controls.conducteur.setValue(pax.nom);
    }
  }

  /** Ouvre le formulaire vide, prêt pour une nouvelle navette. */
  ouvrirCreation(): void {
    this.navetteEnEdition.set(null);
    this.form.reset({ sens: Sens.ALLER, capacite: 4 });
    this.afficherFormulaire.set(true);
  }

  /** Ouvre le formulaire pré-rempli avec les valeurs actuelles de la navette, prêt à modifier. */
  modifier(navette: Navette & { placesRestantes: number }): void {
    this.navetteEnEdition.set(navette.id);
    this.form.setValue({
      libelle: navette.libelle,
      sens: navette.sens,
      // Le champ <input type="date"> attend "AAAA-MM-JJ" ; l'API renvoie une
      // date ISO (avec ou sans heure selon la sérialisation) — les 10
      // premiers caractères suffisent dans les deux cas.
      jour: navette.jour.slice(0, 10),
      conducteur: navette.conducteur ?? "",
      vehicule: navette.vehicule ?? "",
      heureDepart: navette.heureDepart,
      heureArriveeGare: navette.heureArriveeGare,
      heureRetourLieu: navette.heureRetourLieu ?? "",
      capacite: navette.capacite,
      commentaire: navette.commentaire ?? "",
      driverPaxId: navette.driverPaxId ?? "",
    });
    this.afficherFormulaire.set(true);
  }

  annulerEdition(): void {
    this.navetteEnEdition.set(null);
    this.afficherFormulaire.set(false);
    this.form.reset({ sens: Sens.ALLER, capacite: 4 });
  }

  soumettre(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valeurs = this.form.getRawValue();
    const donnees = {
      libelle: valeurs.libelle,
      sens: valeurs.sens,
      jour: valeurs.jour,
      conducteur: valeurs.conducteur || undefined,
      vehicule: valeurs.vehicule || undefined,
      heureDepart: valeurs.heureDepart,
      heureArriveeGare: valeurs.heureArriveeGare,
      heureRetourLieu: valeurs.heureRetourLieu || undefined,
      capacite: valeurs.capacite,
      commentaire: valeurs.commentaire || undefined,
      driverPaxId: valeurs.driverPaxId || undefined,
    };

    const idEnEdition = this.navetteEnEdition();
    const requete = idEnEdition
      ? this.api.modifierNavette(idEnEdition, donnees)
      : this.api.creerNavette({ eventId: this.eventId(), ...donnees });

    requete.subscribe(() => {
      this.annulerEdition();
      this.charger();
      // Si le détail de cette navette était ouvert, on le rafraîchit pour
      // refléter les changements (ex: passager·es toujours à jour).
      if (this.navetteOuverte()?.id === idEnEdition) {
        this.api.recupererNavette(idEnEdition!).subscribe((navette) => this.navetteOuverte.set(navette));
      }
    });
  }

  voirDetail(id: string): void {
    if (this.navetteOuverte()?.id === id) {
      this.navetteOuverte.set(null);
      return;
    }
    this.api.recupererNavette(id).subscribe((navette) => this.navetteOuverte.set(navette));
  }
}
