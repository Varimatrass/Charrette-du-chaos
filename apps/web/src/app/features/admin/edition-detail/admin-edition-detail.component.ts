import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MatTabsModule } from "@angular/material/tabs";
import type { Edition } from "@desordre/shared-types";
import { ApiService } from "../../../core/services/api.service";
import { PaxsTabComponent } from "./paxs-tab/paxs-tab.component";
import { NavettesTabComponent } from "./navettes-tab/navettes-tab.component";
import { TrajetsTabComponent } from "./trajets-tab/trajets-tab.component";

@Component({
  selector: "app-admin-edition-detail",
  standalone: true,
  imports: [MatTabsModule, PaxsTabComponent, NavettesTabComponent, TrajetsTabComponent],
  templateUrl: "./admin-edition-detail.component.html",
  styleUrl: "./admin-edition-detail.component.scss",
})
export class AdminEditionDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  readonly editionId = this.route.snapshot.paramMap.get("id")!;
  readonly edition = signal<Edition | null>(null);

  constructor() {
    this.api.recupererEdition(this.editionId).subscribe((edition) => this.edition.set(edition));
  }
}
