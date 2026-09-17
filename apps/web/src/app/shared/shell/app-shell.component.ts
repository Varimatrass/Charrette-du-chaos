import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { Component, inject, input, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { map } from "rxjs";

/** Une entrée de la barre latérale. */
export interface ShellLink {
  label: string;
  icon: string;
  link: unknown[];
  /** Ne surligner que si l'URL correspond exactement (pour la racine d'une section). */
  exact?: boolean;
}

/**
 * Coque commune des écrans connectés (pax et admin) : une barre latérale de
 * navigation à gauche, le contenu de la route active à droite. Sur mobile
 * la barre se replie derrière un bouton.
 */
@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
  ],
  templateUrl: "./app-shell.component.html",
  styleUrl: "./app-shell.component.scss",
})
export class AppShellComponent {
  private readonly breakpoints = inject(BreakpointObserver);

  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly links = input.required<ShellLink[]>();
  /** Lien "retour" affiché au-dessus des entrées (ex: revenir à la liste des évènements). */
  readonly backLink = input<ShellLink | null>(null);

  readonly isHandset = toSignal(
    this.breakpoints
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  readonly opened = signal(false);

  toggle(): void {
    this.opened.update((value) => !value);
  }

  /** Sur mobile, on referme la barre après avoir choisi une page. */
  onNavigate(): void {
    if (this.isHandset()) this.opened.set(false);
  }
}
