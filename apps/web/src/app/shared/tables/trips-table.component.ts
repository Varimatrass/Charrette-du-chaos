import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatChipsModule } from "@angular/material/chips";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
import { HttpErrorResponse } from "@angular/common/http";
import { forkJoin, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { Direction, TransportMode, TripStatus, WaitLevel } from "@desordre/shared-types";
import type {
  ShuttleWithRemainingSeats,
  TripChangeField,
  TripFieldChange,
  TripOverview,
  TripWithPax,
} from "@desordre/shared-types";
import { TRANSPORT_MODE_LABELS } from "../../core/labels";
import { AdminApiService } from "../../core/api/admin-api.service";
import { EventsApiService } from "../../core/api/events-api.service";
import { PaxApiService } from "../../core/api/pax-api.service";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { EntityOption, EntitySelectComponent } from "../entity-select/entity-select.component";
import { contextEventId, DIRECTIONS, summarizeTrip, TableContext } from "./table-role";

/** Une ligne, quel que soit le rôle. Les coordonnées/commentaires n'existent que côté orga. */
interface TripRow {
  id: string;
  paxId: string;
  paxName: string;
  isMine: boolean;
  direction: Direction;
  mode: TransportMode | null;
  summary: string;
  day: string | null;
  time: string | null;
  stationName: string | null;
  origin: string | null;
  status: TripStatus;
  shuttleId: string | null;
  waitLevel: WaitLevel | null;
  comment?: string | null;
  /** Orga : modifications du pax pas encore vues, en phrases ("Heure : 08:05 → 09:40"). */
  pendingChanges?: { id: string; at: string; lines: string[] }[];
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
  private readonly eventsApi = inject(EventsApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly TripStatus = TripStatus;
  readonly WaitLevel = WaitLevel;
  readonly directions = DIRECTIONS;

  readonly direction = signal<Direction>(Direction.OUTBOUND);
  readonly statusFilter = signal<TripStatus | null>(null);
  /** Orga : ne montrer que les trajets que le pax a modifiés depuis la dernière vérification. */
  readonly onlyChanged = signal(false);
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
        (this.statusFilter() === null || row.status === this.statusFilter()) &&
        (!this.onlyChanged() || !!row.pendingChanges?.length),
    ),
  );

  /**
   * Navettes proposables pour chaque ligne qu'on peut modifier, dans la
   * direction affichée. Côté pax, les pleines et celles d'un autre jour que
   * son trajet restent visibles mais grisées (avec la raison) ; l'orga peut
   * tout choisir (surbooking compris), le jour différent est juste signalé.
   */
  readonly shuttleOptionsByRow = computed(() => {
    const options = new Map<string, EntityOption[]>();
    const shuttles = this.shuttles().filter((shuttle) => shuttle.direction === this.direction());
    for (const row of this.visibleRows()) {
      if (!this.canAssign(row)) continue;
      options.set(
        row.id,
        shuttles.map((shuttle) => {
          const otherDay = !!row.day && sameDay(row.day, shuttle.day) === false;
          const seats = shuttle.remainingSeats;
          const seatsHint =
            seats < 0 ? `surbookée (+${-seats})` : `${seats} place${seats > 1 ? "s" : ""}`;
          const dayHint = otherDay ? ` · ${formatDay(shuttle.day)}, pas ton jour` : "";
          return {
            id: shuttle.id,
            label: shuttle.label,
            hint: `${formatDay(shuttle.day)} ${shuttle.departureTime} · ${seatsHint}${this.isAdmin() ? "" : dayHint}`,
            disabled: !this.isAdmin() && shuttle.id !== row.shuttleId && (seats <= 0 || otherDay),
          };
        }),
      );
    }
    return options;
  });

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
        preferredStationId: this.preferredStationId(context),
      }).subscribe({
        next: ({ trips, shuttles, cars, preferredStationId }) => {
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
              mode: trip.mode,
              summary: summarizeTrip(trip, shuttlesById, carsById, preferredStationId),
              day: trip.day,
              time: trip.time,
              stationName: trip.station?.name ?? null,
              origin: trip.origin,
              status: trip.status,
              shuttleId: trip.shuttleId,
              waitLevel: trip.waitLevel,
              comment: trip.comment,
              pendingChanges: trip.pendingChanges.map((change) => ({
                id: change.id,
                at: change.createdAt,
                lines: change.changes.map(describeFieldChange),
              })),
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
      preferredStationId: this.preferredStationId(context),
    }).subscribe({
      next: ({ trips, shuttles, cars, preferredStationId }) => {
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
            mode: trip.mode,
            summary: summarizeTrip(trip, shuttlesById, carsById, preferredStationId),
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

  /** La gare desservie par les navettes (pour le résumé des trajets en train). */
  private preferredStationId(context: TableContext) {
    const eventId = contextEventId(context);
    return eventId
      ? this.eventsApi.get(eventId).pipe(
          map((event) => event.preferredStationId),
          catchError(() => of(null)),
        )
      : of(null);
  }

  setDirection(direction: Direction): void {
    this.direction.set(direction);
  }

  setStatusFilter(status: TripStatus | null): void {
    this.statusFilter.set(status);
  }

  /**
   * Les navettes sont réservées aux trajets en train. Un pax ne peut changer
   * de navette que pour son propre trajet ; l'orga pour tous.
   */
  canAssign(row: TripRow): boolean {
    return row.mode === TransportMode.TRAIN && (this.isAdmin() || row.isMine);
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

  /** Nombre de trajets (de la direction affichée) modifiés depuis la dernière vérification. */
  readonly changedCount = computed(
    () =>
      this.rows().filter((row) => row.direction === this.direction() && row.pendingChanges?.length)
        .length,
  );

  /** L'orga a vu les modifications (sans changer le statut du trajet). */
  acknowledgeChanges(row: TripRow): void {
    this.adminApi.acknowledgeTripChanges(row.id).subscribe(() => {
      this.snackBar.open("Modifications marquées comme vues.", undefined, { duration: 2000 });
      this.load();
    });
  }

  markAsChecked(row: TripRow): void {
    this.adminApi.setTripStatus(row.id, { status: TripStatus.ASSIGNED }).subscribe(() => {
      this.snackBar.open("Marqué comme vérifié.", undefined, { duration: 2000 });
      this.load();
    });
  }
}

/** Compare deux dates ISO (avec ou sans heure) au jour près. */
function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

/** "ven. 18/09" : assez court pour tenir dans un indice de sélecteur. */
function formatDay(isoDate: string): string {
  return new Date(isoDate.slice(0, 10) + "T00:00:00Z").toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

const CHANGE_FIELD_LABELS: Record<TripChangeField, string> = {
  mode: "Transport",
  day: "Jour",
  time: "Heure",
  station: "Gare",
  comment: "Commentaire",
  shuttle: "Navette",
};

/** "Heure : 08:05 → 09:40", avec les valeurs lisibles (mode en français, jour formaté). */
function describeFieldChange(change: TripFieldChange): string {
  const show = (value: string | null): string => {
    if (value === null || value === "") return "—";
    if (change.field === "mode") return TRANSPORT_MODE_LABELS[value as TransportMode] ?? value;
    if (change.field === "day") return formatDay(value);
    return value;
  };
  return `${CHANGE_FIELD_LABELS[change.field]} : ${show(change.before)} → ${show(change.after)}`;
}
