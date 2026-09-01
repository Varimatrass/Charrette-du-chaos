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
  private readonly keySignal = signal<string | null>(localStorage.getItem(STORAGE_KEY));
  readonly key = this.keySignal.asReadonly();

  get isConnected(): boolean {
    return !!this.keySignal();
  }

  setKey(key: string): void {
    localStorage.setItem(STORAGE_KEY, key);
    this.keySignal.set(key);
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.keySignal.set(null);
  }
}
