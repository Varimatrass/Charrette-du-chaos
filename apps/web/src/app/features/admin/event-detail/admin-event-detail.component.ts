import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MatTabsModule } from "@angular/material/tabs";
import type { Event } from "@desordre/shared-types";
import { EventsApiService } from "../../../core/api/events-api.service";
import { PaxsTabComponent } from "./paxs-tab/paxs-tab.component";
import { ShuttlesTabComponent } from "./shuttles-tab/shuttles-tab.component";
import { TripsTabComponent } from "./trips-tab/trips-tab.component";

@Component({
  selector: "app-admin-event-detail",
  standalone: true,
  imports: [MatTabsModule, PaxsTabComponent, ShuttlesTabComponent, TripsTabComponent],
  templateUrl: "./admin-event-detail.component.html",
  styleUrl: "./admin-event-detail.component.scss",
})
export class AdminEventDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly eventsApi = inject(EventsApiService);

  readonly eventId = this.route.snapshot.paramMap.get("id")!;
  readonly event = signal<Event | null>(null);

  constructor() {
    this.eventsApi.get(this.eventId).subscribe((event) => this.event.set(event));
  }
}
