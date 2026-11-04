import { AfterViewInit, Component, inject, viewChild } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import type { UpsertCarInput } from "@desordre/shared-types";
import { CarFormComponent } from "./car-form.component";

/** Ce que le pax a déjà tapé sur sa voiture (pour ne rien lui faire ressaisir). */
export interface CarDialogData {
  draft: Partial<UpsertCarInput>;
}

/**
 * Boîte de dialogue "il manque des infos sur ta voiture" : s'ouvre quand un
 * pax enregistre un trajet "avec ma voiture" sans avoir encore déclaré sa
 * voiture (ou avec un formulaire incomplet). Se ferme avec la voiture à
 * enregistrer, ou `undefined` si iel annule.
 */
@Component({
  selector: "app-car-dialog",
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, CarFormComponent],
  template: `
    <h2 mat-dialog-title>Il manque des infos sur ta voiture</h2>
    <mat-dialog-content>
      <p>
        Pour conduire en covoit, ta voiture doit être déclarée : c'est elle que les autres paxs
        choisiront pour monter avec toi.
      </p>
      <app-car-form />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Annuler</button>
      <button mat-flat-button color="primary" type="button" (click)="confirm()">
        Enregistrer ma voiture et mon trajet
      </button>
    </mat-dialog-actions>
  `,
})
export class CarDialogComponent implements AfterViewInit {
  private readonly data = inject<CarDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CarDialogComponent, UpsertCarInput>);
  private readonly carForm = viewChild.required(CarFormComponent);

  ngAfterViewInit(): void {
    this.carForm().form.patchValue(this.data.draft);
  }

  confirm(): void {
    const form = this.carForm().form;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.carForm().toInput());
  }
}
