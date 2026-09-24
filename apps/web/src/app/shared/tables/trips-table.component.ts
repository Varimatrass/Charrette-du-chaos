import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatChipsModule } from "@angular/material/chips";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
import { HttpErrorResponse } from "@angular/common/http";
import { forkJoin, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { Direction, TripStatus, WaitLevel } from "@desordre/shared-types";
import type { ShuttleWithRemainingSeats, TripOverview, TripWithPax } from "@desordre/shared-types";
import { AdminApiService } from "../../core/api/admin-api.service";
import { PaxApiService } from "../../core/api/pax-api.service";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { EntityOption, EntitySelectComponent } from "../entity-select/entity-select.component";
import { DIRECTIONS, summarizeTrip, TableContext } from "./table-role";

/** Une ligne, quel que soit le rôle. Les coordonnées/commentaires n'existent que côté orga. */
interface TripRow {
  id: string;
  paxId: string;
  paxName: string;
  isMine: boolean;
  direction: Direction;
  summary: string;
  day: string | null;
  time: string | null;
  stationName: string | null;
  origin: string | null;
  status: TripStatus;
  shuttleId: string | null;
  waitLevel: WaitLevel | null;
  comment?: string | null;
}

/**
 * Tableau des trajets / demandes, par direction. L'orga assigne n'importe
 * quel trajet à une navette et valide les "à revérifier" ; un pax voit tout
 * le monde mais ne peut se mettre que lui/elle-même dans une navette, et
 * seulement s'il reste de la place.
 */
@Component({
  selector: "app-trips-table",
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatSnackBarModule,
    MatTableModule,
    EntitySelectComponent,
    ...LABEL_PIPES,
  ],
  templateUrl: "./trips-table.component.html",
  styleUrl: "./tables.scss",
})
export class TripsTableComponent {
  readonly context = input.required<TableContext>();

  private readonly adminApi = inject(AdminApiService);
  private readonly paxApi = inject(PaxApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly TripStatus = TripStatus;
  readonly WaitLevel = WaitLevel;
  readonly directions = DIRECTIONS;

  readonly direction = signal<Direction>(Direction.OUTBOUND);
  readonly statusFilter = signal<TripStatus | null>(null);
  readonly rows = signal<TripRow[]>([]);
  readonly shuttles = signal<ShuttleWithRemainingSeats[]>([]);
  readonly loading = signal(true);

  readonly isAdmin = computed(() => this.context().role === "admin");
  readonly columns = computed(() =>
    this.isAdmin()
      ? ["pax", "summary", "when", "where", "wait", "status", "shuttle", "comment"]
      : ["pax", "summary", "when", "where", "status", "shuttle"],
  );
  readonly visibleRows = computed(() =>
    this.rows().filter(
      (row) =>
        row.direction === this.direction() &&
        (this.statusFilter() === null || row.status === this.statusFilter()),
    ),
  );

  /** Navettes proposables pour la direction affichée ; les pleines restent visibles mais grisées côté pax. */
  readonly shuttleOptions = computed<EntityOption[]>(() =>
    this.shuttles()
      .filter((shuttle) => shuttle.direction === this.direction())
      .map((shuttle) => ({
        id: shuttle.id,
        label: shuttle.label,
        hint: `${shuttle.departureTime} · ${shuttle.remainingSeats} place${shuttle.remainingSeats > 1 ? "s" : ""}`,
        disabled: !this.isAdmin() && shuttle.remainingSeats <= 0,
      })),
  );

  constructor() {
    effect(() => this.load(this.context()));
  }

  load(context: TableContext = this.context()): void {
    this.loading.set(true);
    if (context.role === "admin" && context.eventId) {
      forkJoin({
        trips: this.adminApi.listTrips(context.eventId),
        shuttles: this.adminApi.listShuttles(context.eventId),
        cars: this.adminApi.listCars(context.eventId).pipe(catchError(() => of([]))),
      }).subscribe({
        next: ({ trips, shuttles, cars }) => {
          const shuttlesById = new Map(shuttles.map((s) => [s.id, s]));
          const carsById = new Map(cars.map((c) => [c.id, c]));
          this.shuttles.set(shuttles);
          this.rows.set(
            trips.map((trip: TripWithPax) => ({
              id: trip.id,
              paxId: trip.paxId,
              paxName: trip.pax.name,
              isMine: false,
              direction: trip.direction,
              summary: summarizeTrip(trip, shuttlesById, carsById),
              day: trip.day,
              time: trip.time,
              stationName: trip.station?.name ?? null,
              origin: trip.origin,
              status: trip.status,
              shuttleId: trip.shuttleId,
              waitLevel: trip.waitLevel,
              comment: trip.comment,
            })),
          );
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }

    const token = context.token ?? "";
    forkJoin({
      trips: this.paxApi.listMyEventTrips(token),
      shuttles: this.paxApi.listMyEventShuttles(token),
      cars: this.paxApi.listMyEventCars(token).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ trips, shuttles, cars }) => {
        const shuttlesById = new Map(shuttles.map((s) => [s.id, s]));
        const carsById = new Map(cars.map((c) => [c.id, c]));
        this.shuttles.set(shuttles);
        this.rows.set(
          trips.map((trip: TripOverview) => ({
            id: trip.id,
            paxId: trip.paxId,
            paxName: trip.paxName,
            isMine: trip.paxId === context.myPaxId,
            direction: trip.direction,
            summary: summarizeTrip(trip, shuttlesById, carsById),
            day: trip.day,
            time: trip.time,
            stationName: trip.stationName,
            origin: trip.origin,
            status: trip.status,
            shuttleId: trip.shuttleId,
            waitLevel: trip.waitLevel,
          })),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setDirection(direction: Direction): void {
    this.direction.set(direction);
  }

  setStatusFilter(status: TripStatus | null): void {
    this.statusFilter.set(status);
  }

  /** Un pax ne peut changer de navette que pour son propre trajet ; l'orga pour tous. */
  canAssign(row: TripRow): boolean {
    return this.isAdmin() || row.isMine;
  }

  onShuttleChange(row: TripRow, shuttleId: string | null): void {
    if (shuttleId === row.shuttleId) return;
    const request = this.isAdmin()
      ? this.adminApi.assignTrip(row.id, { shuttleId })
      : this.paxApi.setMyShuttle(this.context().token ?? "", row.direction, { shuttleId });
    request.subscribe({
      next: () => {
        this.snackBar.open(shuttleId ? "Navette enregistrée." : "Navette retirée.", undefined, {
          duration: 2000,
        });
        this.load();
      },
      error: (error: unknown) => {
        const message =
          error instanceof HttpErrorResponse && typeof error.error?.message === "string"
            ? error.error.message
            : "Impossible de changer de navette.";
        this.snackBar.open(message, undefined, { duration: 4000 });
        this.load();
      },
    });
  }

  shuttleLabel(shuttleId: string): string {
    return this.shuttles().find((shuttle) => shuttle.id === shuttleId)?.label ?? "?";
  }

  markAsChecked(row: TripRow): void {
    this.adminApi.setTripStatus(row.id, { status: TripStatus.ASSIGNED }).subscribe(() => {
      this.snackBar.open("Marqué comme vérifié.", undefined, { duration: 2000 });
      this.load();
    });
  }
}
