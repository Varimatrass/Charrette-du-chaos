import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from "@angular/core";
import { DatePipe } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatRadioModule } from "@angular/material/radio";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { HttpErrorResponse } from "@angular/common/http";
import { forkJoin, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { Direction, TripStatus } from "@desordre/shared-types";
import type {
  Car,
  CarOverview,
  DriverAvailabilitySlot,
  EventWithStations,
  PaxWithTrips,
  Shuttle,
  Station,
} from "@desordre/shared-types";
import { EventsApiService } from "../../core/api/events-api.service";
import { PaxApiService } from "../../core/api/pax-api.service";
import { appLinks } from "../../core/app-paths";
import { DIRECTIONS } from "../../core/labels";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { emptyToNull, emptyToUndefined } from "../../core/utils/forms";
import { CarFormComponent } from "../../shared/car-form/car-form.component";
import { TripFormComponent } from "../../shared/trip-form/trip-form.component";

const SNACKBAR_SHORT_MS = 2000;
const SNACKBAR_LONG_MS = 3000;

/**
 * "Mon espace" : l'écran personnel d'un pax, accessible par son lien
 * (jeton dans l'URL). Il y modifie ses infos, sa voiture, ses trajets
 * aller/retour et ses disponibilités pour conduire. Les tableaux de
 * l'évènement sont sur une page à part.
 */
@Component({
  selector: "app-my-space",
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    TripFormComponent,
    CarFormComponent,
    ...LABEL_PIPES,
  ],
  templateUrl: "./my-space.component.html",
  styleUrl: "./my-space.component.scss",
})
export class MySpaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly paxApi = inject(PaxApiService);
  private readonly eventsApi = inject(EventsApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly TripStatus = TripStatus;
  readonly directions = DIRECTIONS;

  readonly token = this.route.parent?.snapshot.paramMap.get("token") ?? "";
  readonly personalLink = `${window.location.origin}/${appLinks.mySpace(this.token).slice(1).join("/")}`;
  readonly tablesLink = appLinks.paxTables(this.token);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pax = signal<PaxWithTrips | null>(null);
  readonly event = signal<EventWithStations | null>(null);
  readonly stations = signal<Station[]>([]);
  readonly cars = signal<CarOverview[]>([]);
  readonly savingInfo = signal(false);
  readonly savingTrip = signal<Direction | null>(null);
  readonly savingCar = signal(false);
  /** Le pax veut déclarer une voiture (bloc ouvert) même s'il n'en a pas encore en base. */
  readonly showCarForm = signal(false);

  readonly myAvailabilitySlots = signal<DriverAvailabilitySlot[]>([]);
  readonly savingAvailabilitySlot = signal(false);

  readonly tripForms = viewChildren(TripFormComponent);
  readonly carForm = viewChild(CarFormComponent);

  readonly myCar = computed(() => this.pax()?.car ?? null);
  readonly isDriverSomewhere = computed(() => this.tripForms().some((form) => form.isDriver()));
  readonly carSectionVisible = computed(
    () => !!this.myCar() || this.isDriverSomewhere() || this.showCarForm(),
  );

  readonly personalInfoForm = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl("", { nonNullable: true, validators: [Validators.email] }),
    discordHandle: new FormControl("", { nonNullable: true }),
    contactPhone: new FormControl("", { nonNullable: true }),
    comment: new FormControl("", { nonNullable: true }),
    hasDrivingLicense: new FormControl<boolean | null>(null),
    willingToDriveShuttle: new FormControl<boolean | null>(null),
  });

  readonly availabilitySlotForm = new FormGroup({
    day: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    startTime: new FormControl("", { nonNullable: true }),
    endTime: new FormControl("", { nonNullable: true }),
    comment: new FormControl("", { nonNullable: true }),
  });

  /** Données chargées en attente d'un formulaire rendu pour les afficher. */
  private readonly tripsToPatch = signal<PaxWithTrips["trips"] | null>(null);
  private readonly carToPatch = signal<Car | null>(null);

  constructor() {
    effect(() => {
      const forms = this.tripForms();
      const trips = this.tripsToPatch();
      if (!trips || forms.length === 0) return;
      untracked(() => {
        for (const form of forms) {
          const trip = trips.find((t) => t.direction === form.direction());
          if (trip) form.patchFrom(trip);
        }
        this.tripsToPatch.set(null);
      });
    });
    effect(() => {
      const form = this.carForm();
      const car = this.carToPatch();
      if (!form || !car) return;
      untracked(() => {
        form.patchFrom(car);
        this.carToPatch.set(null);
      });
    });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.paxApi.getMySpace(this.token).subscribe({
      next: (pax) => {
        this.pax.set(pax);
        this.fillForms(pax);
        this.loading.set(false);
        forkJoin({
          event: this.eventsApi.get(pax.eventId),
          cars: this.paxApi.listMyEventCars(this.token).pipe(catchError(() => of([]))),
        }).subscribe(({ event, cars }) => {
          this.event.set(event);
          this.stations.set(event.stations);
          this.cars.set(cars);
        });
        this.loadMyAvailabilitySlots();
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          "Ce lien personnel n'est plus valide. Contacte l'organisation pour le retrouver.",
        );
      },
    });
  }

  private fillForms(pax: PaxWithTrips): void {
    this.personalInfoForm.patchValue({
      name: pax.name,
      contactEmail: pax.contactEmail ?? "",
      discordHandle: pax.discordHandle ?? "",
      contactPhone: pax.contactPhone ?? "",
      comment: pax.comment ?? "",
      hasDrivingLicense: pax.hasDrivingLicense,
      willingToDriveShuttle: pax.willingToDriveShuttle,
    });
    // Les formulaires de trajet et de voiture sont rendus après le chargement :
    // les `effect` du constructeur les remplissent dès qu'ils apparaissent.
    this.tripsToPatch.set(pax.trips);
    this.carToPatch.set(pax.car);
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

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse && typeof error.error?.message === "string"
      ? error.error.message
      : fallback;
  }

  assignedShuttle(direction: Direction): Shuttle | null {
    return this.pax()?.trips.find((t) => t.direction === direction)?.shuttle ?? null;
  }

  tripStatus(direction: Direction): TripStatus | null {
    return this.pax()?.trips.find((t) => t.direction === direction)?.status ?? null;
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
        hasDrivingLicense: values.hasDrivingLicense,
        willingToDriveShuttle: values.willingToDriveShuttle,
      })
      .subscribe({
        next: () => {
          this.savingInfo.set(false);
          this.notify("Tes infos ont été enregistrées.", SNACKBAR_LONG_MS);
          this.load();
        },
        error: () => {
          this.savingInfo.set(false);
          this.notify("Échec de l'enregistrement, réessaie.", SNACKBAR_LONG_MS);
        },
      });
  }

  saveCar(): void {
    const form = this.carForm();
    if (!form) return;
    if (form.form.invalid) {
      form.form.markAllAsTouched();
      return;
    }
    this.savingCar.set(true);
    this.paxApi.upsertMyCar(this.token, form.toInput()).subscribe({
      next: () => {
        this.savingCar.set(false);
        this.notify("Voiture enregistrée.");
        this.paxApi.updateMyInfo(this.token, { hasVehicle: true }).subscribe(() => this.load());
      },
      error: () => {
        this.savingCar.set(false);
        this.notify("Échec de l'enregistrement, réessaie.", SNACKBAR_LONG_MS);
      },
    });
  }

  deleteCar(): void {
    this.paxApi.deleteMyCar(this.token).subscribe({
      next: () => {
        this.showCarForm.set(false);
        this.notify("Voiture retirée.");
        this.load();
      },
      error: () => this.notify("Échec, réessaie.", SNACKBAR_LONG_MS),
    });
  }

  saveTrip(direction: Direction): void {
    const form = this.tripForms().find((f) => f.direction() === direction);
    if (!form) return;
    this.savingTrip.set(direction);
    this.paxApi.upsertMyTrip(this.token, direction, form.toInput()).subscribe({
      next: () => {
        this.savingTrip.set(null);
        this.notify("Trajet enregistré.", SNACKBAR_LONG_MS);
        this.load();
      },
      error: (error: unknown) => {
        this.savingTrip.set(null);
        this.notify(this.errorMessage(error, "Échec de l'enregistrement, réessaie."), 4000);
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
