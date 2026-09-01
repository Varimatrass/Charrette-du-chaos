import { Component, inject, input, OnChanges, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatChipsModule } from "@angular/material/chips";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
import { Sens, StatutTrajet } from "@desordre/shared-types";
import type { Navette, TrajetAvecPax } from "@desordre/shared-types";
import { ApiService } from "../../../../core/services/api.service";

@Component({
  selector: "app-trajets-tab",
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  templateUrl: "./trajets-tab.component.html",
  styleUrl: "./trajets-tab.component.scss",
})
export class TrajetsTabComponent implements OnChanges {
  readonly editionId = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly Sens = Sens;
  readonly StatutTrajet = StatutTrajet;
  readonly colonnes = ["pax", "sens", "mode", "quand", "attente", "statut", "navette"];

  readonly trajets = signal<TrajetAvecPax[]>([]);
  readonly navettes = signal<Navette[]>([]);
  readonly filtreStatut = signal<StatutTrajet | null>(null);

  ngOnChanges(): void {
    this.charger();
    this.api.listerNavettes(this.editionId()).subscribe((navettes) => this.navettes.set(navettes));
  }

  charger(): void {
    this.api
      .listerTrajets(this.editionId(), this.filtreStatut() ?? undefined)
      .subscribe((trajets) => this.trajets.set(trajets));
  }

  changerFiltre(statut: StatutTrajet | null): void {
    this.filtreStatut.set(statut);
    this.charger();
  }

  navettesCompatibles(trajet: TrajetAvecPax): Navette[] {
    return this.navettes().filter((n) => n.sens === trajet.sens);
  }

  assigner(trajet: TrajetAvecPax, navetteId: string | null): void {
    this.api.assignerTrajet(trajet.id, { navetteId }).subscribe(() => {
      this.snackBar.open("Assignation mise à jour.", undefined, { duration: 2000 });
      this.charger();
    });
  }

  marquerVerifie(trajet: TrajetAvecPax): void {
    this.api.changerStatutTrajet(trajet.id, { statut: StatutTrajet.ASSIGNE }).subscribe(() => {
      this.snackBar.open("Marqué comme vérifié.", undefined, { duration: 2000 });
      this.charger();
    });
  }
}
