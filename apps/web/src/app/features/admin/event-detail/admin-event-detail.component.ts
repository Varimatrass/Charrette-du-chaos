import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MatTabsModule } from "@angular/material/tabs";
import type { Event } from "@desordre/shared-types";
import { ApiService } from "../../../core/services/api.service";
import { PaxsTabComponent } from "./paxs-tab/paxs-tab.component";
import { NavettesTabComponent } from "./navettes-tab/navettes-tab.component";
import { TrajetsTabComponent } from "./trajets-tab/trajets-tab.component";

@Component({
  selector: "app-admin-event-detail",
  standalone: true,
  imports: [MatTabsModule, PaxsTabComponent, NavettesTabComponent, TrajetsTabComponent],
  templateUrl: "./admin-event-detail.component.html",
  styleUrl: "./admin-event-detail.component.scss",
})
export class AdminEventDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  readonly eventId = this.route.snapshot.paramMap.get("id")!;
  readonly event = signal<Event | null>(null);

  constructor() {
    this.api.recupererEvent(this.eventId).subscribe((event) => this.event.set(event));
  }
}
