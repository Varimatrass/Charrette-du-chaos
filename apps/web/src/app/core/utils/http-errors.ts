import { HttpErrorResponse } from "@angular/common/http";

/**
 * Message d'erreur à afficher : celui de l'API quand elle en donne un (ils
 * sont écrits en français pour être montrés tels quels), sinon `fallback`.
 * Les erreurs de validation de Nest arrivent parfois en tableau : on prend
 * la première.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const message: unknown = error.error?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return fallback;
}
