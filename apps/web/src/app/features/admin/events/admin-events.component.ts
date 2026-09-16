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
import { EventsApiService } from "../../../core/api/events-api.service";
import { appLinks } from "../../../core/app-paths";

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
  private readonly eventsApi = inject(EventsApiService);

  readonly events = signal<Event[]>([]);
  readonly showForm = signal(false);
  readonly eventLink = appLinks.adminEvent;

  readonly form = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    endDate: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    location: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    referenceStation: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.eventsApi.list().subscribe((events) => this.events.set(events));
  }

  toggleForm(): void {
    this.showForm.update((shown) => !shown);
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.eventsApi.create(this.form.getRawValue()).subscribe(() => {
      this.form.reset();
      this.showForm.set(false);
      this.load();
    });
  }
}
