import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTableModule } from "@angular/material/table";
import { DatePipe } from "@angular/common";
import { Direction, TransportMode, TripStatus, VehicleLendingMode } from "@desordre/shared-types";
import type {
  DriverAvailabilitySlot,
  PassengerName,
  PaxOverview,
  PaxWithTrips,
  Shuttle,
  ShuttleWithPassengerNames,
  TripOverview,
} from "@desordre/shared-types";
import { PaxApiService } from "../../core/api/pax-api.service";
import { DIRECTIONS } from "../../core/labels";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { emptyToNull, emptyToUndefined, toDateInputValue } from "../../core/utils/forms";

interface TripForm {
  mode: FormControl<TransportMode | null>;
  day: FormControl<string>;
  time: FormControl<string>;
  station: FormControl<string>;
  comment: FormControl<string>;
}

function createTripForm(): FormGroup<TripForm> {
  return new FormGroup<TripForm>({
    mode: new FormControl<TransportMode | null>(null),
    day: new FormControl("", { nonNullable: true }),
    time: new FormControl("", { nonNullable: true }),
    station: new FormControl("", { nonNullable: true }),
    comment: new FormControl("", { nonNullable: true }),
  });
}

const SNACKBAR_SHORT_MS = 2000;
const SNACKBAR_LONG_MS = 3000;

/** Résumé lisible du bloc véhicule/conduite d'un pax pour l'annuaire. */
export function describeVehicleInfo(pax: PaxOverview): string {
  const parts: string[] = [];
  if (pax.hasVehicle === true) {
    parts.push("a une voiture");
    if (pax.vehicleLendingMode === VehicleLendingMode.AVAILABLE_ANY_DRIVER) {
      parts.push("prête même si iel ne conduit pas");
    } else if (pax.vehicleLendingMode === VehicleLendingMode.ONLY_IF_OWNER_DRIVES) {
      parts.push("prête seulement si iel conduit");
    }
  } else if (pax.hasVehicle === false && pax.hasDrivingLicense) {
    parts.push("a le permis");
  }
  if (pax.hasVehicle !== null && pax.willingToDriveShuttle) {
    parts.push("partant·e pour conduire");
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}

/**
 * "Mon espace" : l'écran personnel d'un pax, accessible par son lien
 * (jeton dans l'URL). Il y voit le planning des navettes, les autres paxs,
 * tous les trajets, et modifie ses infos / ses trajets / ses disponibilités.
 */
@Component({
  selector: "app-my-space",
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    ...LABEL_PIPES,
  ],
  templateUrl: "./my-space.component.html",
  styleUrl: "./my-space.component.scss",
})
export class MySpaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly paxApi = inject(PaxApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly TransportMode = TransportMode;
  readonly TripStatus = TripStatus;
  readonly directions = DIRECTIONS;

  readonly token = this.route.snapshot.paramMap.get("token")!;
  readonly personalLink = window.location.href;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pax = signal<PaxWithTrips | null>(null);
  readonly savingInfo = signal(false);
  readonly savingTrip = signal<Direction | null>(null);

  readonly shuttles = signal<ShuttleWithPassengerNames[]>([]);
  readonly shuttleColumns = ["label", "direction", "day", "times", "driver", "seats", "passengers"];

  readonly eventPaxs = signal<PaxOverview[]>([]);
  readonly paxColumns = ["name", "discord", "vehicle", "comment"];

  readonly eventTrips = signal<TripOverview[]>([]);
  readonly tripColumns = ["pax", "direction", "mode", "when", "status", "shuttle"];

  readonly myAvailabilitySlots = signal<DriverAvailabilitySlot[]>([]);
  readonly savingAvailabilitySlot = signal(false);

  readonly availabilitySlotForm = new FormGroup({
    day: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    startTime: new FormControl("", { nonNullable: true }),
    endTime: new FormControl("", { nonNullable: true }),
    comment: new FormControl("", { nonNullable: true }),
  });

  readonly personalInfoForm = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl("", { nonNullable: true, validators: [Validators.email] }),
    discordHandle: new FormControl("", { nonNullable: true }),
    contactPhone: new FormControl("", { nonNullable: true }),
    comment: new FormControl("", { nonNullable: true }),
  });

  readonly tripForms: Record<Direction, FormGroup<TripForm>> = {
    [Direction.OUTBOUND]: createTripForm(),
    [Direction.RETURN]: createTripForm(),
  };

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.paxApi.getMySpace(this.token).subscribe({
      next: (pax) => {
        this.pax.set(pax);
        this.fillForms(pax);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          "Ce lien personnel n'est plus valide. Contacte l'organisation pour le retrouver.",
        );
      },
    });

    // Planning des navettes, annuaire des paxs et vue d'ensemble des trajets :
    // trois chargements indépendants du reste, une erreur sur l'un d'eux ne
    // doit pas empêcher d'afficher/modifier ses propres infos et trajets.
    this.paxApi.listMyEventShuttles(this.token).subscribe({
      next: (shuttles) => this.shuttles.set(shuttles),
      error: () => this.shuttles.set([]),
    });
    this.paxApi.listMyEventPaxs(this.token).subscribe({
      next: (paxs) => this.eventPaxs.set(paxs),
      error: () => this.eventPaxs.set([]),
    });
    this.paxApi.listMyEventTrips(this.token).subscribe({
      next: (trips) => this.eventTrips.set(trips),
      error: () => this.eventTrips.set([]),
    });
    this.loadMyAvailabilitySlots();
  }

  private fillForms(pax: PaxWithTrips): void {
    this.personalInfoForm.patchValue({
      name: pax.name,
      contactEmail: pax.contactEmail ?? "",
      discordHandle: pax.discordHandle ?? "",
      contactPhone: pax.contactPhone ?? "",
      comment: pax.comment ?? "",
    });

    for (const direction of this.directions) {
      const trip = pax.trips.find((t) => t.direction === direction);
      if (!trip) continue;
      this.tripForms[direction].patchValue({
        mode: trip.mode,
        day: toDateInputValue(trip.day),
        time: trip.time ?? "",
        station: trip.station ?? "",
        comment: trip.comment ?? "",
      });
    }
  }

  private loadMyAvailabilitySlots(): void {
    this.paxApi.listMyAvailabilitySlots(this.token).subscribe({
      next: (slots) => this.myAvailabilitySlots.set(slots),
      error: () => this.myAvailabilitySlots.set([]),
    });
  }

  private notify(message: string, durationMs = SNACKBAR_SHORT_MS): void {
    this.snackBar.open(message, undefined, { duration: durationMs });
  }

  assignedShuttle(direction: Direction): Shuttle | null {
    return this.pax()?.trips.find((t) => t.direction === direction)?.shuttle ?? null;
  }

  tripStatus(direction: Direction): TripStatus | null {
    return this.pax()?.trips.find((t) => t.direction === direction)?.status ?? null;
  }

  /** Pour surligner dans le planning la ou les navettes déjà assignées à ce pax. */
  isMyShuttle(shuttleId: string): boolean {
    return (this.pax()?.trips ?? []).some((t) => t.shuttle?.id === shuttleId);
  }

  passengerNames(passengers: PassengerName[]): string {
    return passengers.map((p) => p.name).join(", ");
  }

  describeVehicleInfo(pax: PaxOverview): string {
    return describeVehicleInfo(pax);
  }

  copyPersonalLink(): void {
    void navigator.clipboard.writeText(this.personalLink);
    this.notify("Lien copié !");
  }

  savePersonalInfo(): void {
    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      return;
    }
    this.savingInfo.set(true);
    const values = this.personalInfoForm.getRawValue();
    this.paxApi
      .updateMyInfo(this.token, {
        name: values.name,
        // Un champ vidé doit vraiment être effacé côté API, d'où `null` et pas `undefined`.
        contactEmail: emptyToNull(values.contactEmail),
        discordHandle: emptyToNull(values.discordHandle),
        contactPhone: emptyToNull(values.contactPhone),
        comment: emptyToNull(values.comment),
      })
      .subscribe({
        next: () => {
          this.savingInfo.set(false);
          this.notify("Tes infos ont été enregistrées.", SNACKBAR_LONG_MS);
        },
        error: () => {
          this.savingInfo.set(false);
          this.notify("Échec de l'enregistrement, réessaie.", SNACKBAR_LONG_MS);
        },
      });
  }

  saveTrip(direction: Direction): void {
    const form = this.tripForms[direction];
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.savingTrip.set(direction);
    const values = form.getRawValue();

    this.paxApi
      .upsertMyTrip(this.token, direction, {
        mode: values.mode ?? undefined,
        day: emptyToUndefined(values.day),
        time: emptyToUndefined(values.time),
        station: emptyToUndefined(values.station),
        comment: emptyToUndefined(values.comment),
      })
      .subscribe({
        next: () => {
          this.savingTrip.set(null);
          this.notify("Trajet enregistré.", SNACKBAR_LONG_MS);
          this.load();
        },
        error: () => {
          this.savingTrip.set(null);
          this.notify("Échec de l'enregistrement, réessaie.", SNACKBAR_LONG_MS);
        },
      });
  }

  addAvailabilitySlot(): void {
    if (this.availabilitySlotForm.invalid) {
      this.availabilitySlotForm.markAllAsTouched();
      return;
    }
    const values = this.availabilitySlotForm.getRawValue();
    this.savingAvailabilitySlot.set(true);
    this.paxApi
      .addMyAvailabilitySlot(this.token, {
        day: values.day,
        startTime: emptyToUndefined(values.startTime),
        endTime: emptyToUndefined(values.endTime),
        comment: emptyToUndefined(values.comment),
      })
      .subscribe({
        next: () => {
          this.savingAvailabilitySlot.set(false);
          this.availabilitySlotForm.reset();
          this.notify("Créneau ajouté.");
          this.loadMyAvailabilitySlots();
        },
        error: () => {
          this.savingAvailabilitySlot.set(false);
          this.notify("Échec de l'ajout, réessaie.", SNACKBAR_LONG_MS);
        },
      });
  }

  deleteAvailabilitySlot(id: string): void {
    this.paxApi.deleteMyAvailabilitySlot(this.token, id).subscribe({
      next: () => {
        this.notify("Créneau supprimé.");
        this.loadMyAvailabilitySlots();
      },
      error: () => this.notify("Échec de la suppression, réessaie.", SNACKBAR_LONG_MS),
    });
  }
}
