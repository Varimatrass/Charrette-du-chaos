import { Component, inject, input, OnChanges, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
import type { PaxAdmin } from "@desordre/shared-types";
import { AdminApiService } from "../../../../core/api/admin-api.service";
import { buildPersonalLink } from "../../../../core/utils/personal-link";

/** Liste des paxs d'un évènement, recherche par nom et récupération d'un lien personnel perdu. */
@Component({
  selector: "app-paxs-tab",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  templateUrl: "./paxs-tab.component.html",
  styleUrl: "./paxs-tab.component.scss",
})
export class PaxsTabComponent implements OnChanges {
  readonly eventId = input.required<string>();

  private readonly adminApi = inject(AdminApiService);
  private readonly snackBar = inject(MatSnackBar);

  readonly columns = ["name", "contact", "link"];
  readonly paxs = signal<PaxAdmin[]>([]);
  readonly openedPaxId = signal<string | null>(null);

  readonly searchControl = new FormControl("", { nonNullable: true });

  ngOnChanges(): void {
    this.load();
  }

  load(): void {
    this.adminApi.listPaxs(this.eventId()).subscribe((paxs) => this.paxs.set(paxs));
  }

  search(): void {
    const name = this.searchControl.value.trim();
    if (!name) {
      this.load();
      return;
    }
    this.adminApi.searchPaxs(this.eventId(), name).subscribe((paxs) => this.paxs.set(paxs));
  }

  resetSearch(): void {
    this.searchControl.reset();
    this.load();
  }

  toggleLink(paxId: string): void {
    this.openedPaxId.update((current) => (current === paxId ? null : paxId));
  }

  personalLinkOf(pax: PaxAdmin): string {
    return buildPersonalLink(pax.accessToken);
  }

  copyLink(pax: PaxAdmin): void {
    void navigator.clipboard.writeText(this.personalLinkOf(pax));
    this.snackBar.open(`Lien de ${pax.name} copié.`, undefined, { duration: 2000 });
  }
}
