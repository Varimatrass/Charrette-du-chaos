import { Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";

/** Ce qu'affiche la boîte de confirmation : un titre, un texte, une liste éventuelle. */
export interface ConfirmDialogData {
  title: string;
  message: string;
  /** Lignes à lister sous le message (ex: les passager·es qui vont être retiré·es). */
  items?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  /** Action destructrice : bouton de confirmation en rouge. */
  danger?: boolean;
}

/**
 * Boîte de confirmation générique. Se ferme avec `true` si on confirme,
 * `false`/`undefined` sinon :
 * `dialog.open(ConfirmDialogComponent, { data }).afterClosed()`.
 */
@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.items?.length) {
        <ul>
          @for (item of data.items; track $index) {
            <li>{{ item }}</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">
        {{ data.cancelLabel ?? "Annuler" }}
      </button>
      <button
        mat-flat-button
        type="button"
        [color]="data.danger ? 'warn' : 'primary'"
        [mat-dialog-close]="true"
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
