import { Component, inject, input, OnChanges, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatChipsModule } from "@angular/material/chips";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
import { TripStatus, WaitLevel } from "@desordre/shared-types";
import type { Shuttle, TripWithPax } from "@desordre/shared-types";
import { AdminApiService } from "../../../../core/api/admin-api.service";
import { LABEL_PIPES } from "../../../../core/pipes/label.pipes";

/** Demandes de trajet d'un évènement : filtre par statut, assignation à une navette, validation. */
@Component({
  selector: "app-trips-tab",
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    ...LABEL_PIPES,
  ],
  templateUrl: "./trips-tab.component.html",
  styleUrl: "./trips-tab.component.scss",
})
export class TripsTabComponent implements OnChanges {
  readonly eventId = input.required<string>();

  private readonly adminApi = inject(AdminApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly TripStatus = TripStatus;
  readonly WaitLevel = WaitLevel;
  readonly columns = ["pax", "direction", "mode", "when", "wait", "status", "shuttle"];

  readonly trips = signal<TripWithPax[]>([]);
  readonly shuttles = signal<Shuttle[]>([]);
  readonly statusFilter = signal<TripStatus | null>(null);

  ngOnChanges(): void {
    this.load();
    this.adminApi.listShuttles(this.eventId()).subscribe((shuttles) => this.shuttles.set(shuttles));
  }

  load(): void {
    this.adminApi
      .listTrips(this.eventId(), this.statusFilter() ?? undefined)
      .subscribe((trips) => this.trips.set(trips));
  }

  setStatusFilter(status: TripStatus | null): void {
    this.statusFilter.set(status);
    this.load();
  }

  /** Seules les navettes allant dans le même sens que le trajet sont proposées. */
  compatibleShuttles(trip: TripWithPax): Shuttle[] {
    return this.shuttles().filter((shuttle) => shuttle.direction === trip.direction);
  }

  assign(trip: TripWithPax, shuttleId: string | null): void {
    this.adminApi.assignTrip(trip.id, { shuttleId }).subscribe(() => {
      this.snackBar.open("Assignation mise à jour.", undefined, { duration: 2000 });
      this.load();
    });
  }

  markAsChecked(trip: TripWithPax): void {
    this.adminApi.setTripStatus(trip.id, { status: TripStatus.ASSIGNED }).subscribe(() => {
      this.snackBar.open("Marqué comme vérifié.", undefined, { duration: 2000 });
      this.load();
    });
  }
}
