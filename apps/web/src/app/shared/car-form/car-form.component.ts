import { Component } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatRadioModule } from "@angular/material/radio";
import { VehicleLendingMode } from "@desordre/shared-types";
import type { Car, UpsertCarInput } from "@desordre/shared-types";
import { LABEL_PIPES } from "../../core/pipes/label.pipes";

/** Formulaire de SA voiture : nom, places pour des passager·es, prêt pour les navettes. */
@Component({
  selector: "app-car-form",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    ...LABEL_PIPES,
  ],
  templateUrl: "./car-form.component.html",
  styleUrl: "./car-form.component.scss",
})
export class CarFormComponent {
  readonly VehicleLendingMode = VehicleLendingMode;
  readonly lendingModes = Object.values(VehicleLendingMode);

  readonly form = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    seats: new FormControl(3, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(20)],
    }),
    lendingMode: new FormControl<VehicleLendingMode>(VehicleLendingMode.NOT_AVAILABLE, {
      nonNullable: true,
    }),
  });

  patchFrom(car: Car): void {
    this.form.patchValue({ name: car.name, seats: car.seats, lendingMode: car.lendingMode });
  }

  toInput(): UpsertCarInput {
    return this.form.getRawValue();
  }
}
