import { Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatRadioModule } from "@angular/material/radio";
import { MatStepperModule } from "@angular/material/stepper";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { forkJoin, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { Direction, TransportMode, VehicleLendingMode } from "@desordre/shared-types";
import type { CreatePaxInput, Event, UpsertTripInput } from "@desordre/shared-types";
import { EventsApiService } from "../../core/api/events-api.service";
import { PaxApiService } from "../../core/api/pax-api.service";
import { appLinks } from "../../core/app-paths";
import { DIRECTIONS } from "../../core/labels";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { emptyToUndefined } from "../../core/utils/forms";

interface PersonalInfoForm {
  name: FormControl<string>;
  contactEmail: FormControl<string>;
  discordHandle: FormControl<string>;
  contactPhone: FormControl<string>;
  comment: FormControl<string>;
}

interface TripForm {
  mode: FormControl<TransportMode | null>;
  day: FormControl<string>;
  time: FormControl<string>;
  station: FormControl<string>;
  comment: FormControl<string>;
}

interface VehicleForm {
  hasVehicle: FormControl<boolean | null>;
  vehicleLendingMode: FormControl<VehicleLendingMode | null>;
  hasDrivingLicense: FormControl<boolean | null>;
  willingToDriveShuttle: FormControl<boolean | null>;
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

/** Le bloc véhicule/conduite n'a de sens que si un trajet se fait autrement qu'en train. */
export function involvesVehicle(mode: TransportMode | null): boolean {
  return mode === TransportMode.CARPOOL || mode === TransportMode.OTHER;
}

/**
 * Un trajet n'est envoyé que si le pax a renseigné au moins une info pour
 * ce sens. Rien renseigné = "je sais pas encore", à compléter plus tard
 * depuis "mon espace" — pas la peine de créer une ligne vide en base.
 */
export function tripFormToInput(
  values: ReturnType<FormGroup<TripForm>["getRawValue"]>,
): UpsertTripInput | null {
  const input: UpsertTripInput = {
    mode: values.mode ?? undefined,
    day: emptyToUndefined(values.day),
    time: emptyToUndefined(values.time),
    station: emptyToUndefined(values.station),
    comment: emptyToUndefined(values.comment),
  };
  const isEmpty = Object.values(input).every((value) => value === undefined);
  return isEmpty ? null : input;
}

/**
 * Inscription en deux étapes : infos perso, puis transport (aller/retour,
 * avec le bloc véhicule/conduite qui n'apparaît que si l'un des deux se
 * fait autrement qu'en train). Rien n'est envoyé avant la toute dernière
 * étape — un pax qui abandonne en cours de route ne laisse aucune trace.
 */
@Component({
  selector: "app-registration",
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatStepperModule,
    MatProgressSpinnerModule,
    ...LABEL_PIPES,
  ],
  templateUrl: "./registration.component.html",
  styleUrl: "./registration.component.scss",
})
export class RegistrationComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsApi = inject(EventsApiService);
  private readonly paxApi = inject(PaxApiService);

  readonly eventId = this.route.snapshot.paramMap.get("eventId")!;
  readonly event = signal<Event | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly Direction = Direction;
  readonly TransportMode = TransportMode;
  readonly VehicleLendingMode = VehicleLendingMode;
  readonly directions = DIRECTIONS;
  readonly backLink = appLinks.eventLanding(this.eventId);

  readonly personalInfoForm = new FormGroup<PersonalInfoForm>({
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

  readonly vehicleForm = new FormGroup<VehicleForm>({
    hasVehicle: new FormControl<boolean | null>(null),
    vehicleLendingMode: new FormControl<VehicleLendingMode | null>(null),
    hasDrivingLicense: new FormControl<boolean | null>(null),
    willingToDriveShuttle: new FormControl<boolean | null>(null),
  });

  constructor() {
    this.eventsApi.get(this.eventId).subscribe({
      next: (event) => this.event.set(event),
      error: () => this.error.set("Impossible de charger cet évènement. Vérifie le lien."),
    });
  }

  showVehicleSection(): boolean {
    return this.directions.some((direction) =>
      involvesVehicle(this.tripForms[direction].value.mode ?? null),
    );
  }

  submit(): void {
    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const info = this.personalInfoForm.getRawValue();
    // Le bloc véhicule ne compte que s'il était affiché : sinon on n'envoie
    // pas des réponses données puis rendues obsolètes par un changement de
    // mode de transport avant l'envoi.
    const vehicle = this.showVehicleSection() ? this.vehicleForm.getRawValue() : null;

    const input: CreatePaxInput = {
      eventId: this.eventId,
      name: info.name,
      contactEmail: emptyToUndefined(info.contactEmail),
      discordHandle: emptyToUndefined(info.discordHandle),
      contactPhone: emptyToUndefined(info.contactPhone),
      comment: emptyToUndefined(info.comment),
      hasVehicle: vehicle?.hasVehicle ?? undefined,
      vehicleLendingMode: vehicle?.vehicleLendingMode ?? undefined,
      hasDrivingLicense: vehicle?.hasDrivingLicense ?? undefined,
      willingToDriveShuttle: vehicle?.willingToDriveShuttle ?? undefined,
    };

    this.paxApi.register(input).subscribe({
      next: (result) => this.saveTripsThenRedirect(result.accessToken),
      error: () => {
        this.submitting.set(false);
        this.error.set("L'inscription a échoué, réessaie dans un instant.");
      },
    });
  }

  private saveTripsThenRedirect(token: string): void {
    const requests = this.directions.flatMap((direction) => {
      const input = tripFormToInput(this.tripForms[direction].getRawValue());
      if (!input) return [];
      // Un trajet qui échoue à s'enregistrer ne doit pas bloquer
      // l'inscription : le pax pourra toujours le compléter ensuite.
      return [this.paxApi.upsertMyTrip(token, direction, input).pipe(catchError(() => of(null)))];
    });

    const redirect = () => void this.router.navigate(appLinks.mySpace(token));
    if (requests.length === 0) {
      redirect();
      return;
    }
    forkJoin(requests).subscribe(redirect);
  }
}
