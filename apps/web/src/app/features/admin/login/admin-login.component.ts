import { Component, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { AdminApiService } from "../../../core/api/admin-api.service";
import { appLinks } from "../../../core/app-paths";
import { AdminAuthService } from "../../../core/services/admin-auth.service";

@Component({
  selector: "app-admin-login",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: "./admin-login.component.html",
  styleUrl: "./admin-login.component.scss",
})
export class AdminLoginComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    key: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid) return;
    const key = this.form.getRawValue().key;

    this.submitting.set(true);
    this.error.set(null);

    // On vérifie la clé auprès de l'API avant de la mémoriser : 200 = valide, 401 = refusée.
    this.adminApi.checkKey(key).subscribe({
      next: () => {
        this.adminAuth.setKey(key);
        void this.router.navigate(appLinks.admin());
      },
      error: () => {
        this.submitting.set(false);
        this.error.set("Clé refusée.");
      },
    });
  }
}
