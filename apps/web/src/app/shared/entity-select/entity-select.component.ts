import { Component, computed, effect, input, model, output, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from "@angular/material/autocomplete";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";

/** Une option sélectionnable : un identifiant, un libellé, et éventuellement une ligne secondaire. */
export interface EntityOption {
  id: string;
  label: string;
  hint?: string;
  /** Une option grisée reste visible (ex: navette pleine) mais ne peut pas être choisie. */
  disabled?: boolean;
}

/**
 * Sélecteur avec recherche : une liste (gare, pax, navette, voiture...) dans
 * laquelle on peut taper pour filtrer, utile dès qu'il y a beaucoup de choix.
 * Optionnellement, une valeur tapée qui ne correspond à rien peut être
 * proposée à la création (`allowCreate`) — le parent reçoit alors le texte.
 *
 * Valeur : l'`id` de l'option choisie, ou `null`.
 */
@Component({
  selector: "app-entity-select",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: "./entity-select.component.html",
  styleUrl: "./entity-select.component.scss",
})
export class EntitySelectComponent {
  readonly options = input.required<EntityOption[]>();
  readonly label = input("");
  readonly placeholder = input("Tape pour chercher…");
  readonly hint = input<string | null>(null);
  readonly disabled = input(false);
  readonly required = input(false);
  /** Texte de l'option "aucun·e" ; `null` pour ne pas la proposer. */
  readonly emptyLabel = input<string | null>("Aucun·e");
  /** Autorise à proposer la création d'une nouvelle entrée avec le texte tapé. */
  readonly allowCreate = input(false);
  readonly createLabel = input("Ajouter");

  /** L'id sélectionné (two-way : `[(value)]`). */
  readonly value = model<string | null>(null);
  /** Émis quand l'utilisateur·ice demande la création d'une entrée avec le texte tapé. */
  readonly create = output<string>();

  readonly searchControl = new FormControl("", { nonNullable: true });
  private readonly query = toSignal(this.searchControl.valueChanges, { initialValue: "" });
  /** Vrai tant que l'entrée affiche le libellé de l'option choisie (pas une recherche en cours). */
  private readonly showingSelection = signal(false);

  readonly filtered = computed(() => {
    const query = normalize(this.showingSelection() ? "" : this.query());
    const options = this.options();
    if (!query) return options;
    return options.filter((option) =>
      normalize(`${option.label} ${option.hint ?? ""}`).includes(query),
    );
  });

  /** Le texte tapé ne correspond à aucune option : on peut proposer de le créer. */
  readonly canCreate = computed(() => {
    if (!this.allowCreate() || this.showingSelection()) return false;
    const typed = this.query().trim();
    if (!typed) return false;
    return !this.options().some((option) => normalize(option.label) === normalize(typed));
  });

  constructor() {
    // Quand la valeur change de l'extérieur (ou la liste arrive), on affiche le libellé correspondant.
    effect(() => {
      const selected = this.options().find((option) => option.id === this.value());
      this.searchControl.setValue(selected?.label ?? "", { emitEvent: true });
      this.showingSelection.set(true);
    });
    effect(() => {
      if (this.disabled()) this.searchControl.disable({ emitEvent: false });
      else this.searchControl.enable({ emitEvent: false });
    });
  }

  onInput(): void {
    this.showingSelection.set(false);
  }

  onFocus(): void {
    // Au focus, on montre toute la liste (le libellé courant ne filtre pas).
    this.showingSelection.set(true);
  }

  onSelected(event: MatAutocompleteSelectedEvent): void {
    const id = event.option.value as string | null;
    this.value.set(id);
    this.showingSelection.set(true);
  }

  /** Si l'utilisateur·ice quitte le champ sans choisir, on remet le libellé de la sélection. */
  onBlur(): void {
    setTimeout(() => {
      if (this.showingSelection()) return;
      const selected = this.options().find((option) => option.id === this.value());
      this.searchControl.setValue(selected?.label ?? "");
      this.showingSelection.set(true);
    }, 150);
  }

  requestCreate(): void {
    const typed = this.searchControl.value.trim();
    if (typed) this.create.emit(typed);
  }

  clear(): void {
    this.value.set(null);
    this.searchControl.setValue("");
    this.showingSelection.set(true);
  }

  displayWith = (id: string | null): string =>
    this.options().find((option) => option.id === id)?.label ?? "";
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
