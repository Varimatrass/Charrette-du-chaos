import { Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";
import { appLinks } from "../../core/app-paths";
import { AppShellComponent, ShellLink } from "../../shared/shell/app-shell.component";

/** Coque des écrans pax (jeton dans l'URL) : mon espace et les tableaux de l'évènement. */
@Component({
  selector: "app-pax-shell",
  standalone: true,
  imports: [AppShellComponent],
  template: `<app-shell title="Charrette du Chaos" [links]="links()" />`,
})
export class PaxShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly token = toSignal(
    this.route.paramMap.pipe(map((params) => params.get("token") ?? "")),
    {
      initialValue: this.route.snapshot.paramMap.get("token") ?? "",
    },
  );

  readonly links = computed<ShellLink[]>(() => [
    { label: "Mon espace", icon: "person", link: appLinks.mySpace(this.token()), exact: true },
    { label: "Tableaux", icon: "table_chart", link: appLinks.paxTables(this.token()) },
  ]);
}
