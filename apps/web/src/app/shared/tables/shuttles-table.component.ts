import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { DatePipe, LowerCasePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
import { forkJoin, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { Direction, WaitLevel } from "@desordre/shared-types";
import type {
  DriverAvailabilitySlotWithPax,
  ShuttleWithPassengerNames,
  ShuttleWithPassengers,
  ShuttleWithRemainingSeats,
  TripWithPax,
} from "@desordre/shared-types";
import { AdminApiService, PaxAdminWithTrips } from "../../core/api/admin-api.service";
import { PaxApiService } from "../../core/api/pax-api.service";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { emptyToNull, emptyToUndefined, mapValues, toDateInputValue } from "../../core/utils/forms";
import { EntityOption, EntitySelectComponent } from "../entity-select/entity-select.component";
import { DIRECTIONS, TableContext } from "./table-role";

const DEFAULT_CAPACITY = 4;

/** Une ligne : navette + (pax) noms des passager·es et téléphone du conducteur si on est dedans. */
type ShuttleRow = ShuttleWithRemainingSeats &
  Partial<Pick<ShuttleWithPassengerNames, "passengers" | "driverContactPhone">>;

/**
 * Tableau des navettes, par direction (aller / retour). Tout le monde le
 * voit ; seule l'orga crée et modifie une navette, choisit son/sa
 * conducteur·ice parmi les pax et gère la liste des passager·es.
 */
@Component({
  selector: "app-shuttles-table",
  standalone: true,
  imports: [
    DatePipe,
    LowerCasePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    EntitySelectComponent,
    ...LABEL_PIPES,
  ],
  templateUrl: "./shuttles-table.component.html",
  styleUrl: "./tables.scss",
})
export class ShuttlesTableComponent {
  readonly context = input.required<TableContext>();

  private readonly adminApi = inject(AdminApiService);
  private readonly paxApi = inject(PaxApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly Direction = Direction;
  readonly WaitLevel = WaitLevel;
  readonly directions = DIRECTIONS;

  readonly direction = signal<Direction>(Direction.OUTBOUND);
  readonly shuttles = signal<ShuttleRow[]>([]);
  readonly loading = signal(true);
  readonly isAdmin = computed(() => this.context().role === "admin");
  readonly visibleShuttles = computed(() =>
    this.shuttles().filter((shuttle) => shuttle.direction === this.direction()),
  );
  readonly columns = computed(() =>
    this.isAdmin()
      ? ["label", "day", "times", "driver", "seats", "actions"]
      : ["label", "day", "times", "driver", "seats", "passengers"],
  );

  // ---- Côté orga : formulaire de création / modification ----
  readonly showForm = signal(false);
  readonly editingShuttleId = signal<string | null>(null);
  readonly editingShuttle = signal<ShuttleWithPassengers | null>(null);
  readonly eventPaxs = signal<PaxAdminWithTrips[]>([]);
  readonly availabilitySlots = signal<DriverAvailabilitySlotWithPax[]>([]);
  readonly directionTrips = signal<TripWithPax[]>([]);
  readonly driverPaxId = signal<string | null>(null);
  readonly passengerToAdd = signal<string | null>(null);

  readonly form = new FormGroup({
    label: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    day: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    vehicle: new FormControl("", { nonNullable: true }),
    departureTime: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    stationArrivalTime: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required],
    }),
    venueReturnTime: new FormControl("", { nonNullable: true }),
    capacity: new FormControl(DEFAULT_CAPACITY, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    comment: new FormControl("", { nonNullable: true }),
  });

  /** Options du sélecteur de conducteur·ice : les pax dispo ce jour-là d'abord, puis tout le monde. */
  readonly driverOptions = computed<EntityOption[]>(() => {
    const day = this.formDay();
    const available = new Map(
      this.availabilitySlots()
        .filter((slot) => toDateInputValue(slot.day) === day)
        .map((slot) => [slot.pax.id, slot]),
    );
    return this.eventPaxs()
      .map((pax) => {
        const slot = available.get(pax.id);
        return {
          id: pax.id,
          label: pax.name,
          hint: slot
            ? `partant·e ce jour-là${slot.startTime || slot.endTime ? ` (${slot.startTime || "?"}–${slot.endTime || "?"})` : ""}`
            : undefined,
          available: !!slot,
        };
      })
      .sort((a, b) => Number(b.available) - Number(a.available) || a.label.localeCompare(b.label))
      .map(({ available: _available, ...option }) => option);
  });
  private readonly formDay = signal("");

  /** Trajets de la direction pas encore dans la navette en cours de modification. */
  readonly addablePassengerOptions = computed<EntityOption[]>(() => {
    const editing = this.editingShuttle();
    if (!editing) return [];
    return this.directionTrips()
      .filter((trip) => trip.shuttleId !== editing.id)
      .map((trip) => ({
        id: trip.id,
        label: trip.pax.name,
        hint: trip.shuttleId
          ? "déjà dans une autre navette"
          : trip.time
            ? `train à ${trip.time}`
            : undefined,
      }));
  });

  constructor() {
    this.form.controls.day.valueChanges.subscribe((day) => this.formDay.set(day));
    effect(() => this.load(this.context()));
  }

  load(context: TableContext = this.context()): void {
    this.loading.set(true);
    if (context.role === "admin" && context.eventId) {
      forkJoin({
        shuttles: this.adminApi.listShuttles(context.eventId),
        paxs: this.adminApi.listPaxs(context.eventId),
        slots: this.adminApi.listAvailabilitySlots(context.eventId).pipe(catchError(() => of([]))),
      }).subscribe({
        next: ({ shuttles, paxs, slots }) => {
          this.shuttles.set(shuttles);
          this.eventPaxs.set(paxs);
          this.availabilitySlots.set(slots);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }
    this.paxApi.listMyEventShuttles(context.token ?? "").subscribe({
      next: (shuttles) => {
        this.shuttles.set(shuttles);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setDirection(direction: Direction): void {
    this.direction.set(direction);
    if (this.showForm() && !this.editingShuttleId()) this.closeForm();
  }

  passengerNames(shuttle: ShuttleRow): string {
    return (shuttle.passengers ?? []).map((p) => p.name).join(", ");
  }

  // ---- Création / modification (orga) ----

  openCreateForm(): void {
    this.editingShuttleId.set(null);
    this.editingShuttle.set(null);
    this.driverPaxId.set(null);
    this.form.reset();
    this.showForm.set(true);
  }

  openEditForm(shuttle: ShuttleRow): void {
    this.editingShuttleId.set(shuttle.id);
    this.driverPaxId.set(shuttle.driverPaxId);
    this.form.setValue({
      label: shuttle.label,
      day: toDateInputValue(shuttle.day),
      vehicle: shuttle.vehicle ?? "",
      departureTime: shuttle.departureTime,
      stationArrivalTime: shuttle.stationArrivalTime,
      venueReturnTime: shuttle.venueReturnTime ?? "",
      capacity: shuttle.capacity,
      comment: shuttle.comment ?? "",
    });
    this.showForm.set(true);
    this.loadEditingDetails(shuttle.id);
  }

  private loadEditingDetails(shuttleId: string): void {
    const eventId = this.context().eventId ?? "";
    forkJoin({
      shuttle: this.adminApi.getShuttle(shuttleId),
      trips: this.adminApi.listTrips(eventId, { direction: this.direction() }),
    }).subscribe(({ shuttle, trips }) => {
      this.editingShuttle.set(shuttle);
      this.directionTrips.set(trips);
    });
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingShuttleId.set(null);
    this.editingShuttle.set(null);
    this.form.reset();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const values = this.form.getRawValue();
    const required = {
      label: values.label,
      direction: this.direction(),
      day: values.day,
      departureTime: values.departureTime,
      stationArrivalTime: values.stationArrivalTime,
      capacity: values.capacity,
    };
    const optional = {
      vehicle: values.vehicle,
      venueReturnTime: values.venueReturnTime,
      comment: values.comment,
      driverPaxId: this.driverPaxId() ?? "",
    };

    const editingId = this.editingShuttleId();
    const request = editingId
      ? this.adminApi.updateShuttle(editingId, { ...required, ...mapValues(optional, emptyToNull) })
      : this.adminApi.createShuttle({
          eventId: this.context().eventId ?? "",
          ...required,
          ...mapValues(optional, emptyToUndefined),
        });

    request.subscribe({
      next: () => {
        this.snackBar.open(editingId ? "Navette modifiée." : "Navette créée.", undefined, {
          duration: 2000,
        });
        this.closeForm();
        this.load();
      },
      error: () =>
        this.snackBar.open("Échec de l'enregistrement, réessaie.", undefined, { duration: 3000 }),
    });
  }

  addPassenger(): void {
    const tripId = this.passengerToAdd();
    const editing = this.editingShuttle();
    if (!tripId || !editing) return;
    this.adminApi.assignTrip(tripId, { shuttleId: editing.id }).subscribe({
      next: () => {
        this.passengerToAdd.set(null);
        this.loadEditingDetails(editing.id);
        this.load();
      },
      error: () =>
        this.snackBar.open("Impossible d'ajouter ce pax.", undefined, { duration: 3000 }),
    });
  }

  removePassenger(trip: TripWithPax): void {
    const editing = this.editingShuttle();
    if (!editing) return;
    this.adminApi.assignTrip(trip.id, { shuttleId: null }).subscribe({
      next: () => {
        this.loadEditingDetails(editing.id);
        this.load();
      },
      error: () =>
        this.snackBar.open("Impossible de retirer ce pax.", undefined, { duration: 3000 }),
    });
  }
}
