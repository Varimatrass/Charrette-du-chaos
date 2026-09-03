import { Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatListModule } from "@angular/material/list";
import type { Event } from "@desordre/shared-types";
import { ApiService } from "../../../core/services/api.service";

@Component({
  selector: "app-admin-events",
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
  ],
  templateUrl: "./admin-events.component.html",
  styleUrl: "./admin-events.component.scss",
})
export class AdminEventsComponent {
  private readonly api = inject(ApiService);

  readonly events = signal<Event[]>([]);
  readonly afficherFormulaire = signal(false);

  readonly form = new FormGroup({
    nom: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    dateDebut: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    dateFin: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    lieu: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    gareReference: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.charger();
  }

  private charger(): void {
    this.api.listerEvents().subscribe((events) => this.events.set(events));
  }

  creer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.api.creerEvent(this.form.getRawValue()).subscribe(() => {
      this.form.reset();
      this.afficherFormulaire.set(false);
      this.charger();
    });
  }
}
