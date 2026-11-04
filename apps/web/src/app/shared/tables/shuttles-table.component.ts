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
import { Direction, TransportMode, WaitLevel } from "@desordre/shared-types";
import type {
  DriverAvailabilitySlotWithPax,
  ShuttleWithPassengerNames,
  ShuttleWithPassengers,
  ShuttleWithRemainingSeats,
  ShuttleIncompatibilityReason,
  ShuttleUpdateConflict,
  TripWithPax,
  UpdateShuttleInput,
} from "@desordre/shared-types";
import { HttpErrorResponse } from "@angular/common/http";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "../confirm-dialog/confirm-dialog.component";
import { AdminApiService, PaxAdminWithTrips } from "../../core/api/admin-api.service";
import { PaxApiService } from "../../core/api/pax-api.service";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { emptyToNull, emptyToUndefined, mapValues, toDateInputValue } from "../../core/utils/forms";
import { EntityOption, EntitySelectComponent } from "../entity-select/entity-select.component";
import { DIRECTIONS, TableContext } from "./table-role";

const DEFAULT_CAPACITY = 4;

const INCOMPATIBILITY_LABELS: Record<ShuttleIncompatibilityReason, string> = {
  DIRECTION: "la navette ne va plus dans le sens de son trajet",
  DAY: "son trajet est un autre jour",
  CAPACITY: "plus de place (dernier·e arrivé·e dans la navette)",
};

/** Reconnaît la réponse 409 "passager·es incompatibles" de PATCH /admin/shuttles/:id. */
function asShuttleUpdateConflict(error: unknown): ShuttleUpdateConflict | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return null;
  const body = error.error as Partial<ShuttleUpdateConflict> | null;
  return body && Array.isArray(body.incompatible) ? (body as ShuttleUpdateConflict) : null;
}

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
    MatDialogModule,
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
  private readonly dialog = inject(MatDialog);

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

  /**
   * Trajets en train de la direction, pas encore dans la navette en cours de
   * modification. Ceux du jour de la navette et sans navette d'abord (c'est
   * eux qu'on cherche à placer) ; un autre jour reste possible mais signalé.
   */
  readonly addablePassengerOptions = computed<EntityOption[]>(() => {
    const editing = this.editingShuttle();
    if (!editing) return [];
    const shuttleDay = toDateInputValue(editing.day);
    const isOtherDay = (trip: TripWithPax) =>
      !!trip.day && toDateInputValue(trip.day) !== shuttleDay;
    return this.directionTrips()
      .filter((trip) => trip.mode === TransportMode.TRAIN && trip.shuttleId !== editing.id)
      .sort(
        (a, b) =>
          Number(isOtherDay(a)) - Number(isOtherDay(b)) ||
          Number(!!a.shuttleId) - Number(!!b.shuttleId) ||
          a.pax.name.localeCompare(b.pax.name),
      )
      .map((trip) => {
        const hints = [
          trip.time ? `train à ${trip.time}` : null,
          isOtherDay(trip) ? "⚠ un autre jour" : null,
          trip.shuttleId ? "déjà dans une autre navette" : null,
        ].filter((hint) => hint !== null);
        return { id: trip.id, label: trip.pax.name, hint: hints.join(" · ") || undefined };
      });
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
    if (editingId) {
      this.saveChanges(editingId, { ...required, ...mapValues(optional, emptyToNull) });
      return;
    }
    this.adminApi
      .createShuttle({
        eventId: this.context().eventId ?? "",
        ...required,
        ...mapValues(optional, emptyToUndefined),
      })
      .subscribe({
        next: () => this.afterSave("Navette créée."),
        error: (error: unknown) => this.notifyError(error, "Échec de l'enregistrement, réessaie."),
      });
  }

  /**
   * Enregistre une modif de navette. Si elle rend des passager·es
   * incompatibles (autre sens, autre jour, plus assez de places), l'API
   * répond 409 avec la liste : on la montre et on ne retire ces personnes
   * qu'après confirmation.
   */
  private saveChanges(id: string, input: UpdateShuttleInput): void {
    this.adminApi.updateShuttle(id, input).subscribe({
      next: () => this.afterSave("Navette modifiée."),
      error: (error: unknown) => {
        const conflict = asShuttleUpdateConflict(error);
        if (!conflict) {
          this.notifyError(error, "Échec de l'enregistrement, réessaie.");
          return;
        }
        this.dialog
          .open(ConfirmDialogComponent, {
            data: {
              title: "Des passager·es ne tiennent plus dans la navette",
              message: `${conflict.message} Si tu confirmes, iels seront retiré·es de la navette (leur trajet repasse « en attente ») :`,
              items: conflict.incompatible.map(
                (p) => `${p.paxName} — ${INCOMPATIBILITY_LABELS[p.reason]}`,
              ),
              confirmLabel: "Retirer et enregistrer",
              danger: true,
            } satisfies ConfirmDialogData,
          })
          .afterClosed()
          .subscribe((confirmed) => {
            if (confirmed) this.saveChanges(id, { ...input, removeIncompatible: true });
          });
      },
    });
  }

  private afterSave(message: string): void {
    this.snackBar.open(message, undefined, { duration: 2000 });
    this.closeForm();
    this.load();
  }

  private notifyError(error: unknown, fallback: string): void {
    const message =
      error instanceof HttpErrorResponse && typeof error.error?.message === "string"
        ? error.error.message
        : fallback;
    this.snackBar.open(message, undefined, { duration: 4000 });
  }

  /** Supprime la navette en cours de modification, après confirmation. */
  deleteShuttle(): void {
    const editing = this.editingShuttle();
    const id = this.editingShuttleId();
    if (!id) return;
    const passengers = editing?.passengers.map((trip) => trip.pax.name) ?? [];
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Supprimer ${editing?.label ?? "cette navette"} ?`,
          message: passengers.length
            ? "Ces passager·es repasseront « en attente » d'une navette :"
            : "Personne n'est dedans pour l'instant.",
          items: passengers,
          confirmLabel: "Supprimer",
          danger: true,
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.adminApi.deleteShuttle(id).subscribe({
          next: () => this.afterSave("Navette supprimée."),
          error: (error: unknown) => this.notifyError(error, "Impossible de supprimer la navette."),
        });
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
