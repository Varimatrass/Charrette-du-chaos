import { HttpHeaders } from "@angular/common/http";
import { environment } from "../../../environments/environment";

export const API_BASE_URL = environment.apiUrl;

/** En-tête portant le jeton personnel d'un pax (voir PaxTokenGuard côté API). */
export const PAX_TOKEN_HEADER = "x-pax-token";

/** En-tête portant la clé organisateur·ice (voir AdminGuard côté API). */
export const ADMIN_KEY_HEADER = "x-admin-key";

/** Segment d'URL qui identifie une route back-office (les intercepteurs s'appuient dessus). */
export const ADMIN_URL_SEGMENT = "/admin/";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}/${path.replace(/^\//, "")}`;
}

export function paxTokenHeaders(token: string): HttpHeaders {
  return new HttpHeaders({ [PAX_TOKEN_HEADER]: token });
}
