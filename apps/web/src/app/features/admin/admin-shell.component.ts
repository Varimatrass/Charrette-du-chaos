import { Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter, map, startWith } from "rxjs";
import { EventsApiService } from "../../core/api/events-api.service";
import { APP_PATHS, appLinks } from "../../core/app-paths";
import { AppShellComponent, ShellLink } from "../../shared/shell/app-shell.component";

/**
 * Coque du back-office : la liste des évènements, puis, une fois dans un
 * évènement, ses sections (config, paxs, navettes, trajets) avec un lien
 * pour revenir à la liste.
 */
@Component({
  selector: "app-admin-shell",
  standalone: true,
  imports: [AppShellComponent],
  template: `<app-shell
    title="Organisation"
    [subtitle]="eventName()"
    [links]="links()"
    [backLink]="backLink()"
  />`,
})
export class AdminShellComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly eventsApi = inject(EventsApiService);

  /** Id de l'évènement de la route enfant active, s'il y en a un. */
  private readonly eventId = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => deepestParam(this.route, "id")),
    ),
    { initialValue: deepestParam(this.route, "id") },
  );

  readonly eventName = signal<string | null>(null);

  readonly backLink = computed<ShellLink | null>(() =>
    this.eventId()
      ? { label: "Tous les évènements", icon: "arrow_back", link: appLinks.admin() }
      : null,
  );

  readonly links = computed<ShellLink[]>(() => {
    const id = this.eventId();
    if (!id) return [{ label: "Évènements", icon: "event", link: appLinks.admin(), exact: true }];
    const section = (path: string) => appLinks.adminEventSection(id, path);
    return [
      { label: "Configuration", icon: "settings", link: section(APP_PATHS.adminEventConfig) },
      { label: "Paxs", icon: "groups", link: section(APP_PATHS.adminEventPaxs) },
      { label: "Navettes", icon: "airport_shuttle", link: section(APP_PATHS.adminEventShuttles) },
      { label: "Trajets", icon: "route", link: section(APP_PATHS.adminEventTrips) },
    ];
  });

  constructor() {
    let loadedFor: string | null = null;
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
      )
      .subscribe(() => {
        const id = this.eventId();
        if (!id) {
          this.eventName.set(null);
          loadedFor = null;
          return;
        }
        if (id === loadedFor) return;
        loadedFor = id;
        this.eventsApi.get(id).subscribe({
          next: (event) => this.eventName.set(event.name),
          error: () => this.eventName.set(null),
        });
      });
  }
}

/** Cherche un paramètre dans la route enfant la plus profonde. */
function deepestParam(route: ActivatedRoute, name: string): string | null {
  let current: ActivatedRoute | null = route;
  let value: string | null = null;
  while (current) {
    // À la création de la coque, les routes enfants n'ont pas encore de snapshot.
    value = current.snapshot?.paramMap.get(name) ?? value;
    current = current.firstChild;
  }
  return value;
}
