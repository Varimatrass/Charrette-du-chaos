import { Component, inject, input, OnChanges, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatTableModule } from "@angular/material/table";
import { Direction, WaitLevel } from "@desordre/shared-types";
import type {
  DriverAvailabilitySlotWithPax,
  PaxAdmin,
  ShuttleWithPassengers,
  ShuttleWithRemainingSeats,
} from "@desordre/shared-types";
import { AdminApiService } from "../../../../core/api/admin-api.service";
import { LABEL_PIPES } from "../../../../core/pipes/label.pipes";
import {
  emptyToNull,
  emptyToUndefined,
  mapValues,
  toDateInputValue,
} from "../../../../core/utils/forms";

const DEFAULT_CAPACITY = 4;

/** Liste, création et modification des navettes d'un évènement, avec le détail de leurs passager·es. */
@Component({
  selector: "app-shuttles-tab",
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    ...LABEL_PIPES,
  ],
  templateUrl: "./shuttles-tab.component.html",
  styleUrl: "./shuttles-tab.component.scss",
})
export class ShuttlesTabComponent implements OnChanges {
  readonly eventId = input.required<string>();

  private readonly adminApi = inject(AdminApiService);

  readonly Direction = Direction;
  readonly WaitLevel = WaitLevel;
  readonly columns = ["label", "direction", "day", "times", "seats", "actions"];
  readonly shuttles = signal<ShuttleWithRemainingSeats[]>([]);
  readonly showForm = signal(false);
  readonly openedShuttle = signal<ShuttleWithPassengers | null>(null);
  /** Pour le sélecteur "conducteur·ice lié·e à un pax" du formulaire. */
  readonly eventPaxs = signal<PaxAdmin[]>([]);
  /** Créneaux dispo déclarés par les pax partant·es pour conduire, pour les suggérer en priorité. */
  readonly availabilitySlots = signal<DriverAvailabilitySlotWithPax[]>([]);
  /** `null` = formulaire de création ; sinon l'id de la navette en cours de modification. */
  readonly editingShuttleId = signal<string | null>(null);

  readonly form = new FormGroup({
    label: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    direction: new FormControl<Direction>(Direction.OUTBOUND, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    day: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    driverName: new FormControl("", { nonNullable: true }),
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
    driverPaxId: new FormControl("", { nonNullable: true }),
  });

  ngOnChanges(): void {
    this.load();
    this.adminApi.listPaxs(this.eventId()).subscribe((paxs) => this.eventPaxs.set(paxs));
    this.adminApi
      .listAvailabilitySlots(this.eventId())
      .subscribe((slots) => this.availabilitySlots.set(slots));
  }

  load(): void {
    this.adminApi.listShuttles(this.eventId()).subscribe((shuttles) => this.shuttles.set(shuttles));
  }

  /**
   * Quand l'admin choisit un pax dans le sélecteur, on pré-remplit le champ
   * texte "conducteur·ice" avec son nom, par confort — mais il reste éditable
   * librement ensuite (ex: pour préciser "Sophie (voiture rouge)").
   */
  onDriverPaxSelected(paxId: string): void {
    const pax = this.eventPaxs().find((p) => p.id === paxId);
    if (pax && !this.form.controls.driverName.value) {
      this.form.controls.driverName.setValue(pax.name);
    }
  }

  /**
   * Pax ayant déclaré une disponibilité pour conduire au jour actuellement
   * choisi dans le formulaire — une suggestion, pas un filtre : le
   * sélecteur garde toujours tous les pax en dessous, au cas où les
   * disponibilités déclarées ne seraient plus à jour.
   */
  availablePaxsForSelectedDay(): DriverAvailabilitySlotWithPax[] {
    const day = this.form.controls.day.value;
    if (!day) return [];
    return this.availabilitySlots().filter((slot) => toDateInputValue(slot.day) === day);
  }

  /** Ouvre le formulaire vide, prêt pour une nouvelle navette. */
  openCreateForm(): void {
    this.editingShuttleId.set(null);
    this.form.reset();
    this.showForm.set(true);
  }

  /** Ouvre le formulaire pré-rempli avec les valeurs actuelles de la navette, prêt à modifier. */
  openEditForm(shuttle: ShuttleWithRemainingSeats): void {
    this.editingShuttleId.set(shuttle.id);
    this.form.setValue({
      label: shuttle.label,
      direction: shuttle.direction,
      day: toDateInputValue(shuttle.day),
      driverName: shuttle.driverName ?? "",
      vehicle: shuttle.vehicle ?? "",
      departureTime: shuttle.departureTime,
      stationArrivalTime: shuttle.stationArrivalTime,
      venueReturnTime: shuttle.venueReturnTime ?? "",
      capacity: shuttle.capacity,
      comment: shuttle.comment ?? "",
      driverPaxId: shuttle.driverPaxId ?? "",
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.editingShuttleId.set(null);
    this.showForm.set(false);
    this.form.reset();
  }

  toggleForm(): void {
    if (this.showForm()) {
      this.closeForm();
    } else {
      this.openCreateForm();
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const values = this.form.getRawValue();
    const required = {
      label: values.label,
      direction: values.direction,
      day: values.day,
      departureTime: values.departureTime,
      stationArrivalTime: values.stationArrivalTime,
      capacity: values.capacity,
    };
    const optional = {
      driverName: values.driverName,
      vehicle: values.vehicle,
      venueReturnTime: values.venueReturnTime,
      comment: values.comment,
      driverPaxId: values.driverPaxId,
    };

    const editingId = this.editingShuttleId();
    const request = editingId
      ? // Champs facultatifs vidés dans le formulaire = effacés côté API (`null`).
        this.adminApi.updateShuttle(editingId, { ...required, ...mapValues(optional, emptyToNull) })
      : // À la création, un champ facultatif vide est simplement omis.
        this.adminApi.createShuttle({
          eventId: this.eventId(),
          ...required,
          ...mapValues(optional, emptyToUndefined),
        });

    request.subscribe(() => {
      this.closeForm();
      this.load();
      // Si le détail de cette navette était ouvert, on le rafraîchit pour
      // refléter les changements (ex: passager·es toujours à jour).
      if (editingId && this.openedShuttle()?.id === editingId) {
        this.adminApi.getShuttle(editingId).subscribe((shuttle) => this.openedShuttle.set(shuttle));
      }
    });
  }

  toggleDetail(id: string): void {
    if (this.openedShuttle()?.id === id) {
      this.openedShuttle.set(null);
      return;
    }
    this.adminApi.getShuttle(id).subscribe((shuttle) => this.openedShuttle.set(shuttle));
  }
}
