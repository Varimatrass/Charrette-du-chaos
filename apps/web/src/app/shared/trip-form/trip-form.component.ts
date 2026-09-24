import { Component, computed, input, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatRadioModule } from "@angular/material/radio";
import { MatSelectModule } from "@angular/material/select";
import { CarpoolRole, Direction, TransportMode } from "@desordre/shared-types";
import type { CarOverview, Event, Station, Trip, UpsertTripInput } from "@desordre/shared-types";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { emptyToUndefined, toDateInputValue } from "../../core/utils/forms";
import { EntityOption, EntitySelectComponent } from "../entity-select/entity-select.component";

/** Préfixe des gares tapées mais pas encore créées côté API (envoyées via `stationName`). */
const NEW_STATION_PREFIX = "new:";

/** Pour un·e passager·e : a déjà une voiture identifiée, ou en cherche une. */
type PassengerStatus = "HAS_CAR" | "LOOKING";

/**
 * Formulaire d'un trajet (aller ou retour), partagé entre l'inscription et
 * "mon espace" : train (gare existante ou nouvelle), covoiturage (d'où,
 * conducteur·ice ou passager·e, voiture ou "je cherche"), autre, ou "je
 * sais pas encore". Le parent lit `toInput()` pour envoyer à l'API.
 */
@Component({
  selector: "app-trip-form",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    EntitySelectComponent,
    ...LABEL_PIPES,
  ],
  templateUrl: "./trip-form.component.html",
  styleUrl: "./trip-form.component.scss",
})
export class TripFormComponent {
  readonly direction = input.required<Direction>();
  readonly stations = input<Station[]>([]);
  readonly cars = input<CarOverview[]>([]);
  /** Pour pré-remplir le jour : début de l'évènement à l'aller, fin au retour. */
  readonly event = input<Event | null>(null);
  /** Le pax connecté, pour ne pas lui proposer sa propre voiture comme passager·e. */
  readonly myPaxId = input<string | null>(null);
  /** Chaîne affichée dans l'en-tête et les libellés ("aller" / "retour"). */

  readonly TransportMode = TransportMode;
  readonly CarpoolRole = CarpoolRole;

  readonly form = new FormGroup({
    mode: new FormControl<TransportMode | null>(null),
    day: new FormControl("", { nonNullable: true }),
    time: new FormControl("", { nonNullable: true }),
    comment: new FormControl("", { nonNullable: true }),
    origin: new FormControl("", { nonNullable: true }),
    carpoolRole: new FormControl<CarpoolRole | null>(null),
    passengerStatus: new FormControl<PassengerStatus | null>(null),
  });

  /** Gare choisie : un id existant, ou `new:<nom>` pour une gare tapée. */
  readonly stationId = signal<string | null>(null);
  readonly carId = signal<string | null>(null);
  /** Une gare tapée par le pax et pas encore en base, à envoyer comme `stationName`. */
  private readonly newStationName = signal<string | null>(null);

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  readonly mode = computed(() => this.formValue().mode ?? null);
  readonly carpoolRole = computed(() => this.formValue().carpoolRole ?? null);
  readonly passengerStatus = computed(() => this.formValue().passengerStatus ?? null);
  readonly isOutbound = computed(() => this.direction() === Direction.OUTBOUND);

  readonly stationOptions = computed<EntityOption[]>(() => {
    const options: EntityOption[] = this.stations().map((station) => ({
      id: station.id,
      label: station.name,
    }));
    const pending = this.newStationName();
    if (pending)
      options.push({ id: NEW_STATION_PREFIX + pending, label: pending, hint: "nouvelle gare" });
    return options;
  });

  readonly carOptions = computed<EntityOption[]>(() =>
    this.cars()
      .filter((car) => car.owner.id !== this.myPaxId())
      .map((car) => {
        const seats = car.remainingSeats[this.direction()];
        return {
          id: car.id,
          label: `${car.owner.name} — ${car.name}`,
          hint: seats > 0 ? `${seats} place${seats > 1 ? "s" : ""}` : "complet",
          disabled: seats <= 0 && car.id !== this.carId(),
        };
      }),
  );

  /** Le pax a dit conduire sa propre voiture pour ce trajet (le parent affiche alors le bloc voiture). */
  readonly isDriver = computed(
    () => this.mode() === TransportMode.CARPOOL && this.carpoolRole() === CarpoolRole.DRIVER,
  );

  /** Pré-remplit le jour selon l'évènement si le pax n'a encore rien saisi. */
  applyDefaultDay(): void {
    const event = this.event();
    if (!event || this.form.controls.day.value) return;
    this.form.controls.day.setValue(
      toDateInputValue(this.isOutbound() ? event.startDate : event.endDate),
    );
  }

  onCreateStation(name: string): void {
    this.newStationName.set(name);
    this.stationId.set(NEW_STATION_PREFIX + name);
  }

  /** Charge un trajet existant (mon espace). */
  patchFrom(trip: Trip): void {
    this.form.patchValue({
      mode: trip.mode,
      day: toDateInputValue(trip.day),
      time: trip.time ?? "",
      comment: trip.comment ?? "",
      origin: trip.origin ?? "",
      carpoolRole: trip.carpoolRole,
      passengerStatus:
        trip.carpoolRole === CarpoolRole.PASSENGER ? (trip.carId ? "HAS_CAR" : "LOOKING") : null,
    });
    this.stationId.set(trip.stationId);
    this.carId.set(trip.carId);
  }

  /** Rien de renseigné = "je sais pas encore", pas la peine d'envoyer une ligne. */
  isEmpty(): boolean {
    const v = this.form.getRawValue();
    return !v.mode && !v.day && !v.time && !v.comment;
  }

  toInput(): UpsertTripInput {
    const v = this.form.getRawValue();
    const input: UpsertTripInput = {
      mode: v.mode ?? undefined,
      day: emptyToUndefined(v.day),
      time: emptyToUndefined(v.time),
      comment: emptyToUndefined(v.comment),
    };
    if (v.mode === TransportMode.TRAIN) {
      const station = this.stationId();
      if (station?.startsWith(NEW_STATION_PREFIX))
        input.stationName = station.slice(NEW_STATION_PREFIX.length);
      else if (station) input.stationId = station;
    }
    if (v.mode === TransportMode.CARPOOL) {
      input.origin = emptyToUndefined(v.origin);
      input.carpoolRole = v.carpoolRole ?? undefined;
      if (v.carpoolRole === CarpoolRole.PASSENGER) {
        if (v.passengerStatus === "HAS_CAR" && this.carId())
          input.carId = this.carId() ?? undefined;
        else input.lookingForCarpool = true;
      }
    }
    return input;
  }
}
