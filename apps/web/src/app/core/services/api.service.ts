import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type {
  AssignerTrajetInput,
  CreateEventInput,
  CreateNavetteInput,
  CreatePaxInput,
  Event,
  Navette,
  NavetteAvecNomsPassagers,
  NavetteAvecPassagers,
  NavetteAvecPlacesRestantes,
  Pax,
  PaxAdmin,
  PaxSubmissionResult,
  SetStatutTrajetInput,
  StatutTrajet,
  Trajet,
  TrajetAvecPax,
  UpdateEventInput,
  UpdateNavetteInput,
  UpdatePaxInput,
} from "@desordre/shared-types";
import { environment } from "../../../environments/environment";

/** Vue "mon espace" renvoyée par GET /pax/moi : le pax + ses trajets (avec la navette éventuellement assignée). */
export interface PaxAvecTrajets extends Pax {
  trajets: (Trajet & { navette: Navette | null })[];
}

@Injectable({ providedIn: "root" })
export class ApiService {
  private readonly base = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  // ---- Évènements ----

  listerEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.base}/events`);
  }

  recupererEvent(id: string): Observable<Event> {
    return this.http.get<Event>(`${this.base}/events/${id}`);
  }

  creerEvent(input: CreateEventInput): Observable<Event> {
    return this.http.post<Event>(`${this.base}/admin/events`, input);
  }

  modifierEvent(id: string, input: UpdateEventInput): Observable<Event> {
    return this.http.patch<Event>(`${this.base}/admin/events/${id}`, input);
  }

  // ---- Pax (self-service) ----

  creerPax(input: CreatePaxInput): Observable<PaxSubmissionResult> {
    return this.http.post<PaxSubmissionResult>(`${this.base}/pax`, input);
  }

  recupererMonEspace(token: string): Observable<PaxAvecTrajets> {
    return this.http.get<PaxAvecTrajets>(`${this.base}/pax/moi`, {
      headers: { "x-pax-token": token },
    });
  }

  /** Planning des navettes de son évènement (lecture seule, avec noms des co-passager·es). */
  listerNavettesMonEvent(token: string): Observable<NavetteAvecNomsPassagers[]> {
    return this.http.get<NavetteAvecNomsPassagers[]>(`${this.base}/pax/moi/navettes`, {
      headers: { "x-pax-token": token },
    });
  }

  modifierMesInfos(token: string, input: UpdatePaxInput): Observable<Pax> {
    return this.http.patch<Pax>(`${this.base}/pax/moi`, input, {
      headers: { "x-pax-token": token },
    });
  }

  enregistrerMonTrajet(
    token: string,
    sens: "ALLER" | "RETOUR",
    input: { mode: string; jour?: string; heure?: string; gare?: string; commentaire?: string },
  ): Observable<Trajet> {
    return this.http.put<Trajet>(`${this.base}/pax/moi/trajets/${sens}`, input, {
      headers: { "x-pax-token": token },
    });
  }

  // ---- Pax (back-office) ----

  listerPaxsEvent(eventId: string): Observable<PaxAdmin[]> {
    return this.http.get<PaxAdmin[]>(`${this.base}/admin/pax`, { params: { eventId } });
  }

  rechercherPax(eventId: string, nom: string): Observable<PaxAdmin[]> {
    return this.http.get<PaxAdmin[]>(`${this.base}/admin/pax/rechercher`, {
      params: { eventId, nom },
    });
  }

  // ---- Navettes (back-office) ----

  listerNavettes(eventId: string): Observable<NavetteAvecPlacesRestantes[]> {
    return this.http.get<NavetteAvecPlacesRestantes[]>(`${this.base}/admin/navettes`, {
      params: { eventId },
    });
  }

  recupererNavette(id: string): Observable<NavetteAvecPassagers> {
    return this.http.get<NavetteAvecPassagers>(`${this.base}/admin/navettes/${id}`);
  }

  creerNavette(input: CreateNavetteInput): Observable<Navette> {
    return this.http.post<Navette>(`${this.base}/admin/navettes`, input);
  }

  modifierNavette(id: string, input: UpdateNavetteInput): Observable<Navette> {
    return this.http.patch<Navette>(`${this.base}/admin/navettes/${id}`, input);
  }

  // ---- Trajets (back-office) ----

  listerTrajets(eventId: string, statut?: StatutTrajet): Observable<TrajetAvecPax[]> {
    return this.http.get<TrajetAvecPax[]>(`${this.base}/admin/trajets`, {
      params: statut ? { eventId, statut } : { eventId },
    });
  }

  assignerTrajet(id: string, input: AssignerTrajetInput): Observable<Trajet> {
    return this.http.patch<Trajet>(`${this.base}/admin/trajets/${id}/assigner`, input);
  }

  changerStatutTrajet(id: string, input: SetStatutTrajetInput): Observable<Trajet> {
    return this.http.patch<Trajet>(`${this.base}/admin/trajets/${id}/statut`, input);
  }
}
