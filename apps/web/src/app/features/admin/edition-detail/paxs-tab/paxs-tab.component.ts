import { Component, inject, input, OnChanges, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
import type { PaxAdmin } from "@desordre/shared-types";
import { ApiService } from "../../../../core/services/api.service";

@Component({
  selector: "app-paxs-tab",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  templateUrl: "./paxs-tab.component.html",
  styleUrl: "./paxs-tab.component.scss",
})
export class PaxsTabComponent implements OnChanges {
  readonly editionId = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly colonnes = ["nom", "contact", "lien"];
  readonly paxs = signal<PaxAdmin[]>([]);
  readonly paxOuvert = signal<string | null>(null);

  readonly rechercheForm = new FormGroup({
    nom: new FormControl("", { nonNullable: true }),
  });

  ngOnChanges(): void {
    this.charger();
  }

  charger(): void {
    this.api.listerPaxsEdition(this.editionId()).subscribe((paxs) => this.paxs.set(paxs));
  }

  rechercher(): void {
    const nom = this.rechercheForm.getRawValue().nom.trim();
    if (!nom) {
      this.charger();
      return;
    }
    this.api.rechercherPax(this.editionId(), nom).subscribe((paxs) => this.paxs.set(paxs));
  }

  basculerLien(paxId: string): void {
    this.paxOuvert.set(this.paxOuvert() === paxId ? null : paxId);
  }

  lienDe(pax: PaxAdmin): string {
    return `${window.location.origin}/mon-espace/${pax.accessToken}`;
  }

  copierLien(pax: PaxAdmin): void {
    void navigator.clipboard.writeText(this.lienDe(pax));
    this.snackBar.open(`Lien de ${pax.nom} copié.`, undefined, { duration: 2000 });
  }
}
