import { Component, inject, input, OnChanges, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatTableModule } from "@angular/material/table";
import { Sens } from "@desordre/shared-types";
import type { Navette, NavetteAvecPassagers } from "@desordre/shared-types";
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
  });

  ngOnChanges(): void {
    this.charger();
  }

  charger(): void {
    this.api.listerNavettes(this.eventId()).subscribe((navettes) => this.navettes.set(navettes));
  }

  creer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valeurs = this.form.getRawValue();
    this.api
      .creerNavette({
        eventId: this.eventId(),
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
      })
      .subscribe(() => {
        this.form.reset({ sens: Sens.ALLER, capacite: 4 });
        this.afficherFormulaire.set(false);
        this.charger();
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
