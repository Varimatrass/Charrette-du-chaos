import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
import { forkJoin, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import type { CarOverview, Shuttle } from "@desordre/shared-types";
import { AdminApiService } from "../../core/api/admin-api.service";
import { EventsApiService } from "../../core/api/events-api.service";
import { PaxApiService } from "../../core/api/pax-api.service";
import { buildPersonalLink } from "../../core/utils/personal-link";
import { contextEventId, summarizeTrip, TableContext, TripSummaryInput } from "./table-role";

import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { apiErrorMessage } from "../../core/utils/http-errors";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "../confirm-dialog/confirm-dialog.component";
/** Une ligne du tableau, quel que soit le rôle ; les champs sensibles ne sont remplis que pour l'orga. */
interface PaxRow {
  id: string;
  name: string;
  isMe: boolean;
  outbound: string;
  return: string;
  contact?: string;
  discordHandle?: string | null;
  comment?: string | null;
  accessToken?: string;
}

/**
 * Tableau des paxs. Pour un pax : le nom et comment chacun·e vient (train /
 * covoit / autre, cherche une navette ou un covoit). Pour l'orga : en plus
 * les coordonnées, le commentaire, le lien personnel à renvoyer.
 */
@Component({
  selector: "app-paxs-table",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  templateUrl: "./paxs-table.component.html",
  styleUrl: "./tables.scss",
})
export class PaxsTableComponent {
  readonly context = input.required<TableContext>();

  private readonly adminApi = inject(AdminApiService);
  private readonly paxApi = inject(PaxApiService);
  private readonly eventsApi = inject(EventsApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly rows = signal<PaxRow[]>([]);
  readonly loading = signal(true);
  readonly openedPaxId = signal<string | null>(null);
  readonly searchControl = new FormControl("", { nonNullable: true });
  private readonly query = signal("");

  readonly isAdmin = computed(() => this.context().role === "admin");
  readonly columns = computed(() =>
    this.isAdmin()
      ? ["name", "outbound", "return", "contact", "comment", "link", "actions"]
      : ["name", "discord", "outbound", "return"],
  );
  readonly filteredRows = computed(() => {
    const query = this.query().trim().toLowerCase();
    return query
      ? this.rows().filter((row) => row.name.toLowerCase().includes(query))
      : this.rows();
  });

  constructor() {
    this.searchControl.valueChanges.subscribe((value) => this.query.set(value));
    effect(() => {
      const context = this.context();
      this.load(context);
    });
  }

  load(context: TableContext = this.context()): void {
    this.loading.set(true);
    if (context.role === "admin" && context.eventId) {
      forkJoin({
        paxs: this.adminApi.listPaxs(context.eventId),
        shuttles: this.adminApi.listShuttles(context.eventId),
        cars: this.adminApi.listCars(context.eventId).pipe(catchError(() => of([]))),
        preferredStationId: this.preferredStationId(context),
      }).subscribe({
        next: ({ paxs, shuttles, cars, preferredStationId }) => {
          const lookups = buildLookups(shuttles, cars, preferredStationId);
          this.rows.set(
            paxs.map((pax) => ({
              id: pax.id,
              name: pax.name,
              isMe: false,
              outbound: summarizeTrip(findTrip(pax.trips, "OUTBOUND"), ...lookups),
              return: summarizeTrip(findTrip(pax.trips, "RETURN"), ...lookups),
              contact: [pax.contactEmail, pax.contactPhone].filter(Boolean).join(" · ") || "—",
              discordHandle: pax.discordHandle,
              comment: pax.comment,
              accessToken: pax.accessToken,
            })),
          );
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }

    const token = context.token ?? "";
    forkJoin({
      paxs: this.paxApi.listMyEventPaxs(token),
      shuttles: this.paxApi.listMyEventShuttles(token).pipe(catchError(() => of([]))),
      cars: this.paxApi.listMyEventCars(token).pipe(catchError(() => of([]))),
      preferredStationId: this.preferredStationId(context),
    }).subscribe({
      next: ({ paxs, shuttles, cars, preferredStationId }) => {
        const lookups = buildLookups(shuttles, cars, preferredStationId);
        this.rows.set(
          paxs.map((pax) => ({
            id: pax.id,
            name: pax.name,
            isMe: pax.id === context.myPaxId,
            discordHandle: pax.discordHandle,
            outbound: summarizeTrip(findTrip(pax.trips, "OUTBOUND"), ...lookups),
            return: summarizeTrip(findTrip(pax.trips, "RETURN"), ...lookups),
          })),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleLink(paxId: string): void {
    this.openedPaxId.update((current) => (current === paxId ? null : paxId));
  }

  personalLinkOf(row: PaxRow): string {
    return row.accessToken ? buildPersonalLink(row.accessToken) : "";
  }

  /** La gare desservie par les navettes (pour le résumé des trajets en train). */
  private preferredStationId(context: TableContext) {
    const eventId = contextEventId(context);
    return eventId
      ? this.eventsApi.get(eventId).pipe(
          map((event) => event.preferredStationId),
          catchError(() => of(null)),
        )
      : of(null);
  }

  /** Back-office : supprimer un pax (doublon, inscription par erreur), après confirmation. */
  deletePax(row: PaxRow): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Supprimer ${row.name} ?`,
          message:
            "Ses trajets et ses dispos de conduite seront supprimés, et son lien personnel ne marchera plus. Les navettes qu'iel conduisait n'auront plus de conducteur·ice ; sa voiture reste dans la liste (sans propriétaire), avec ses passager·es. C'est définitif.",
          confirmLabel: "Supprimer",
          danger: true,
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.adminApi.deletePax(row.id).subscribe({
          next: () => {
            this.snackBar.open(`${row.name} a été supprimé·e.`, undefined, { duration: 2000 });
            this.load();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              apiErrorMessage(error, "Impossible de supprimer ce pax."),
              undefined,
              {
                duration: 4000,
              },
            ),
        });
      });
  }

  copyLink(row: PaxRow): void {
    void navigator.clipboard.writeText(this.personalLinkOf(row));
    this.snackBar.open(`Lien de ${row.name} copié.`, undefined, { duration: 2000 });
  }
}

function findTrip<T extends { direction: string }>(trips: T[], direction: string): T | undefined {
  return trips.find((trip) => trip.direction === direction);
}

function buildLookups(
  shuttles: Pick<Shuttle, "id" | "label">[],
  cars: CarOverview[],
  preferredStationId: string | null,
): [Map<string, Pick<Shuttle, "label">>, Map<string, CarOverview>, string | null] {
  return [
    new Map(shuttles.map((shuttle) => [shuttle.id, shuttle])),
    new Map(cars.map((car) => [car.id, car])),
    preferredStationId,
  ];
}

// Réexport pour que le type reste visible des templates stricts.
export type { TripSummaryInput };
