import { Component, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatRadioModule } from "@angular/material/radio";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import type { EventWithStations } from "@desordre/shared-types";
import { EventsApiService } from "../../../core/api/events-api.service";
import { appLinks } from "../../../core/app-paths";
import { toDateInputValue } from "../../../core/utils/forms";
import { injectEventId } from "../event-detail/event-id";

/**
 * Configuration d'un évènement : corriger nom/dates/lieu, gérer les gares
 * (ajout, suppression, gare préférée pour les navettes) et l'ouvrir aux
 * inscriptions une fois prêt.
 */
@Component({
  selector: "app-admin-event-config",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
  templateUrl: "./admin-event-config.component.html",
  styleUrl: "./admin-event-config.component.scss",
})
export class AdminEventConfigComponent {
  private readonly eventsApi = inject(EventsApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly eventId = injectEventId();
  readonly event = signal<EventWithStations | null>(null);
  readonly saving = signal(false);
  readonly publicLink = `${window.location.origin}/${appLinks.eventLanding(this.eventId).slice(1).join("/")}`;

  readonly form = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    endDate: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    location: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
  });
  readonly newStationControl = new FormControl("", { nonNullable: true });

  constructor() {
    this.load();
  }

  private load(): void {
    this.eventsApi.get(this.eventId).subscribe((event) => this.apply(event));
  }

  private apply(event: EventWithStations): void {
    this.event.set(event);
    this.form.patchValue({
      name: event.name,
      startDate: toDateInputValue(event.startDate),
      endDate: toDateInputValue(event.endDate),
      location: event.location,
    });
  }

  saveDetails(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.eventsApi.update(this.eventId, this.form.getRawValue()).subscribe({
      next: (event) => {
        this.apply(event);
        this.saving.set(false);
        this.notify("Évènement enregistré.");
      },
      error: () => {
        this.saving.set(false);
        this.notify("Échec de l'enregistrement, réessaie.");
      },
    });
  }

  setOpenToPaxs(open: boolean): void {
    this.eventsApi.update(this.eventId, { openToPaxs: open }).subscribe({
      next: (event) => {
        this.apply(event);
        this.notify(open ? "Évènement ouvert aux inscriptions." : "Évènement masqué de l'accueil.");
      },
      error: () => this.notify("Échec, réessaie."),
    });
  }

  addStation(): void {
    const name = this.newStationControl.value.trim();
    if (!name) return;
    this.eventsApi.addStation(this.eventId, { name }).subscribe({
      next: () => {
        this.newStationControl.reset();
        this.load();
      },
      error: () => this.notify("Impossible d'ajouter cette gare."),
    });
  }

  removeStation(stationId: string): void {
    this.eventsApi.removeStation(this.eventId, stationId).subscribe({
      next: () => this.load(),
      error: () => this.notify("Impossible de supprimer cette gare."),
    });
  }

  setPreferredStation(stationId: string | null): void {
    this.eventsApi.update(this.eventId, { preferredStationId: stationId }).subscribe({
      next: (event) => this.apply(event),
      error: () => this.notify("Échec, réessaie."),
    });
  }

  copyPublicLink(): void {
    void navigator.clipboard.writeText(this.publicLink);
    this.notify("Lien copié !");
  }

  private notify(message: string): void {
    this.snackBar.open(message, undefined, { duration: 2500 });
  }
}
