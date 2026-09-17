import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MatTabsModule } from "@angular/material/tabs";
import { PaxApiService } from "../../core/api/pax-api.service";
import { PaxsTableComponent } from "../../shared/tables/paxs-table.component";
import { ShuttlesTableComponent } from "../../shared/tables/shuttles-table.component";
import { TableContext } from "../../shared/tables/table-role";
import { TripsTableComponent } from "../../shared/tables/trips-table.component";

/** Les tableaux de l'évènement vus par un pax : qui vient, les navettes, les trajets. */
@Component({
  selector: "app-pax-tables",
  standalone: true,
  imports: [MatTabsModule, PaxsTableComponent, ShuttlesTableComponent, TripsTableComponent],
  template: `
    <h1>Tableaux de l'évènement</h1>
    <p class="hint">
      Tout le monde voit qui vient et comment, les navettes et les trajets — jamais les coordonnées
      des autres. Tu ne peux modifier que ton propre trajet.
    </p>
    @if (context(); as ctx) {
      <mat-tab-group>
        <mat-tab label="Paxs"><app-paxs-table [context]="ctx" /></mat-tab>
        <mat-tab label="Navettes"><app-shuttles-table [context]="ctx" /></mat-tab>
        <mat-tab label="Trajets"><app-trips-table [context]="ctx" /></mat-tab>
      </mat-tab-group>
    }
  `,
})
export class PaxTablesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly paxApi = inject(PaxApiService);

  readonly token = this.route.parent?.snapshot.paramMap.get("token") ?? "";
  readonly context = signal<TableContext | null>(null);

  constructor() {
    this.paxApi.getMySpace(this.token).subscribe({
      next: (pax) => this.context.set({ role: "pax", token: this.token, myPaxId: pax.id }),
      error: () => this.context.set({ role: "pax", token: this.token }),
    });
  }
}
