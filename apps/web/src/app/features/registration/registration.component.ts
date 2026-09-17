import { Component, computed, inject, signal, viewChild, viewChildren } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatRadioModule } from "@angular/material/radio";
import { MatStepperModule } from "@angular/material/stepper";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { concatMap, from, of, switchMap, toArray } from "rxjs";
import { catchError } from "rxjs/operators";
import { TransportMode } from "@desordre/shared-types";
import type { CreatePaxInput, EventWithStations, Station } from "@desordre/shared-types";
import { EventsApiService } from "../../core/api/events-api.service";
import { PaxApiService } from "../../core/api/pax-api.service";
import { appLinks } from "../../core/app-paths";
import { DIRECTIONS } from "../../core/labels";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";
import { emptyToUndefined } from "../../core/utils/forms";
import { CarFormComponent } from "../../shared/car-form/car-form.component";
import { TripFormComponent } from "../../shared/trip-form/trip-form.component";

interface PersonalInfoForm {
  name: FormControl<string>;
  contactEmail: FormControl<string>;
  discordHandle: FormControl<string>;
  contactPhone: FormControl<string>;
  comment: FormControl<string>;
}

/**
 * Inscription en deux étapes : infos perso, puis transport (aller/retour
 * avec train / covoiturage / autre, la voiture si le pax conduit, et les
 * questions permis/conduite de navette). Rien n'est envoyé avant la toute
 * dernière étape — un pax qui abandonne en cours de route ne laisse aucune
 * trace.
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
    MatRadioModule,
    MatStepperModule,
    MatProgressSpinnerModule,
    TripFormComponent,
    CarFormComponent,
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
  readonly event = signal<EventWithStations | null>(null);
  readonly stations = signal<Station[]>([]);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly directions = DIRECTIONS;
  readonly backLink = appLinks.eventLanding(this.eventId);

  readonly tripForms = viewChildren(TripFormComponent);
  readonly carForm = viewChild(CarFormComponent);

  readonly personalInfoForm = new FormGroup<PersonalInfoForm>({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl("", { nonNullable: true, validators: [Validators.email] }),
    discordHandle: new FormControl("", { nonNullable: true }),
    contactPhone: new FormControl("", { nonNullable: true }),
    comment: new FormControl("", { nonNullable: true }),
  });

  /** Questions permis/conduite, posées une seule fois (infos sur le pax, pas sur un trajet). */
  readonly drivingForm = new FormGroup({
    hasDrivingLicense: new FormControl<boolean | null>(null),
    willingToDriveShuttle: new FormControl<boolean | null>(null),
  });

  /** Le pax conduit sa voiture sur au moins un trajet → on lui demande sa voiture. */
  readonly isDriver = computed(() => this.tripForms().some((form) => form.isDriver()));
  /** Au moins un trajet en covoit passager·e ou "autre" → permis / envie de conduire une navette. */
  readonly asksDrivingQuestions = computed(() =>
    this.tripForms().some((form) => {
      const mode = form.mode();
      return mode === TransportMode.OTHER || (mode === TransportMode.CARPOOL && !form.isDriver());
    }),
  );

  constructor() {
    this.eventsApi.get(this.eventId).subscribe({
      next: (event) => {
        this.event.set(event);
        this.stations.set(event.stations);
      },
      error: () => this.error.set("Impossible de charger cet évènement. Vérifie le lien."),
    });
  }

  submit(): void {
    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      return;
    }
    const carForm = this.carForm();
    if (this.isDriver() && carForm?.form.invalid) {
      carForm.form.markAllAsTouched();
      this.error.set("Il manque des infos sur ta voiture.");
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const info = this.personalInfoForm.getRawValue();
    const driving =
      this.asksDrivingQuestions() || this.isDriver() ? this.drivingForm.getRawValue() : null;
    const input: CreatePaxInput = {
      eventId: this.eventId,
      name: info.name,
      contactEmail: emptyToUndefined(info.contactEmail),
      discordHandle: emptyToUndefined(info.discordHandle),
      contactPhone: emptyToUndefined(info.contactPhone),
      comment: emptyToUndefined(info.comment),
      hasVehicle: this.isDriver() ? true : this.asksDrivingQuestions() ? false : undefined,
      hasDrivingLicense: this.isDriver() ? true : (driving?.hasDrivingLicense ?? undefined),
      willingToDriveShuttle: driving?.willingToDriveShuttle ?? undefined,
    };

    this.paxApi
      .register(input)
      .pipe(
        switchMap(({ accessToken }) => {
          // La voiture d'abord (un trajet "conducteur·ice" en a besoin), puis les trajets un par un.
          const car$ =
            this.isDriver() && carForm
              ? this.paxApi
                  .upsertMyCar(accessToken, carForm.toInput())
                  .pipe(catchError(() => of(null)))
              : of(null);
          const trips = this.tripForms().filter((form) => !form.isEmpty());
          return car$.pipe(
            switchMap(() =>
              from(trips).pipe(
                // Un trajet qui échoue ne doit pas bloquer l'inscription : le pax pourra le compléter ensuite.
                concatMap((form) =>
                  this.paxApi
                    .upsertMyTrip(accessToken, form.direction(), form.toInput())
                    .pipe(catchError(() => of(null))),
                ),
                toArray(),
              ),
            ),
            switchMap(() => of(accessToken)),
          );
        }),
      )
      .subscribe({
        next: (accessToken) => void this.router.navigate(appLinks.mySpace(accessToken)),
        error: () => {
          this.submitting.set(false);
          this.error.set("L'inscription a échoué, réessaie dans un instant.");
        },
      });
  }
}
