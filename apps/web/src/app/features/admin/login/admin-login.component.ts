import { HttpClient } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { catchError, of } from "rxjs";
import { environment } from "../../../../environments/environment";
import { AdminAuthService } from "../../../core/services/admin-auth.service";

@Component({
  selector: "app-admin-login",
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: "./admin-login.component.html",
  styleUrl: "./admin-login.component.scss",
})
export class AdminLoginComponent {
  private readonly http = inject(HttpClient);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly enCours = signal(false);
  readonly erreur = signal<string | null>(null);

  readonly form = new FormGroup({
    cle: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
  });

  soumettre(): void {
    if (this.form.invalid) return;
    const cle = this.form.getRawValue().cle;

    this.enCours.set(true);
    this.erreur.set(null);

    // On vérifie la clé sur une route admin quelconque : 200 = valide, 401 = refusée.
    this.http
      .get(`${environment.apiUrl}/admin/pax`, {
        params: { editionId: "verification" },
        headers: { "x-admin-key": cle },
      })
      .pipe(catchError(() => of(null)))
      .subscribe((reponse) => {
        this.enCours.set(false);
        if (reponse === null) {
          this.erreur.set("Clé refusée.");
          return;
        }
        this.adminAuth.setKey(cle);
        void this.router.navigate(["/admin"]);
      });
  }
}
