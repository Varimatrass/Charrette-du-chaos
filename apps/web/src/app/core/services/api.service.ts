import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type {
  AssignerTrajetInput,
  CreateDriverAvailabilitySlotInput,
  CreateEventInput,
  CreateNavetteInput,
  CreatePaxInput,
  DriverAvailabilitySlot,
  DriverAvailabilitySlotAvecPax,
  Event,
  Navette,
  NavetteAvecNomsPassagers,
  NavetteAvecPassagers,
  NavetteAvecPlacesRestantes,
  Pax,
  PaxOverview,
  PaxAdmin,
  PaxSubmissionResult,
  SetStatutTrajetInput,
  StatutTrajet,
  Trajet,
  TrajetAvecPax,
  TrajetOverview,
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

  /** Annuaire des paxs de son évènement (lecture seule, jamais leurs coordonnées). */
  listerPaxsMonEvent(token: string): Observable<PaxOverview[]> {
    return this.http.get<PaxOverview[]>(`${this.base}/pax/moi/paxs`, {
      headers: { "x-pax-token": token },
    });
  }

  /** Tous les trajets de son évènement (lecture seule, jamais les coordonnées des autres paxs). */
  listerTrajetsMonEvent(token: string): Observable<TrajetOverview[]> {
    return this.http.get<TrajetOverview[]>(`${this.base}/pax/moi/trajets`, {
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
    // `mode` facultatif : "je sais pas encore" est un choix valide, écrit
    // explicitement `null` en base côté API (voir trajets.service.ts).
    input: { mode?: string; jour?: string; heure?: string; gare?: string; commentaire?: string },
  ): Observable<Trajet> {
    return this.http.put<Trajet>(`${this.base}/pax/moi/trajets/${sens}`, input, {
      headers: { "x-pax-token": token },
    });
  }

  // ---- Disponibilités conducteur·ice (self-service) ----

  listerMesDisponibilites(token: string): Observable<DriverAvailabilitySlot[]> {
    return this.http.get<DriverAvailabilitySlot[]>(`${this.base}/pax/moi/disponibilites`, {
      headers: { "x-pax-token": token },
    });
  }

  ajouterMaDisponibilite(
    token: string,
    input: CreateDriverAvailabilitySlotInput,
  ): Observable<DriverAvailabilitySlot> {
    return this.http.post<DriverAvailabilitySlot>(`${this.base}/pax/moi/disponibilites`, input, {
      headers: { "x-pax-token": token },
    });
  }

  supprimerMaDisponibilite(token: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/pax/moi/disponibilites/${id}`, {
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

  // ---- Disponibilités conducteur·ice (back-office) ----

  /** Pour proposer en priorité, à la création/modification d'une navette, les pax déjà partant·es. */
  listerDisponibilites(eventId: string): Observable<DriverAvailabilitySlotAvecPax[]> {
    return this.http.get<DriverAvailabilitySlotAvecPax[]>(`${this.base}/admin/disponibilites`, {
      params: { eventId },
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
