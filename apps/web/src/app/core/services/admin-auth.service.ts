import { Injectable, signal } from "@angular/core";

const STORAGE_KEY = "desordre-admin-key";

/**
 * Stocke la clé organisateur·ice partagée (V1, pas de vrais comptes) dans le
 * localStorage du navigateur. À remplacer par une vraie authentification le
 * jour où une liste de comptes est mise en place — c'est le seul endroit à
 * changer côté frontend.
 */
@Injectable({ providedIn: "root" })
export class AdminAuthService {
  private readonly keySignal = signal<string | null>(readStoredKey());
  readonly key = this.keySignal.asReadonly();

  get isAuthenticated(): boolean {
    return this.keySignal() !== null;
  }

  setKey(key: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // Stockage indisponible (navigation privée...) : la clé ne survivra pas au rechargement, tant pis.
    }
    this.keySignal.set(key);
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // idem
    }
    this.keySignal.set(null);
  }
}

function readStoredKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
