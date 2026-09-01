import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type {
  AssignerTrajetInput,
  CreateEditionInput,
  CreateNavetteInput,
  CreatePaxInput,
  Edition,
  Navette,
  NavetteAvecPassagers,
  Pax,
  PaxAdmin,
  PaxSubmissionResult,
  SetStatutTrajetInput,
  StatutTrajet,
  Trajet,
  TrajetAvecPax,
  UpdateEditionInput,
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

  // ---- Éditions ----

  listerEditions(): Observable<Edition[]> {
    return this.http.get<Edition[]>(`${this.base}/editions`);
  }

  recupererEdition(id: string): Observable<Edition> {
    return this.http.get<Edition>(`${this.base}/editions/${id}`);
  }

  creerEdition(input: CreateEditionInput): Observable<Edition> {
    return this.http.post<Edition>(`${this.base}/editions`, input);
  }

  modifierEdition(id: string, input: UpdateEditionInput): Observable<Edition> {
    return this.http.patch<Edition>(`${this.base}/editions/${id}`, input);
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

  listerPaxsEdition(editionId: string): Observable<PaxAdmin[]> {
    return this.http.get<PaxAdmin[]>(`${this.base}/admin/pax`, { params: { editionId } });
  }

  rechercherPax(editionId: string, nom: string): Observable<PaxAdmin[]> {
    return this.http.get<PaxAdmin[]>(`${this.base}/admin/pax/rechercher`, {
      params: { editionId, nom },
    });
  }

  // ---- Navettes (back-office) ----

  listerNavettes(editionId: string): Observable<(Navette & { placesRestantes: number })[]> {
    return this.http.get<(Navette & { placesRestantes: number })[]>(`${this.base}/admin/navettes`, {
      params: { editionId },
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

  listerTrajets(editionId: string, statut?: StatutTrajet): Observable<TrajetAvecPax[]> {
    return this.http.get<TrajetAvecPax[]>(`${this.base}/admin/trajets`, {
      params: statut ? { editionId, statut } : { editionId },
    });
  }

  assignerTrajet(id: string, input: AssignerTrajetInput): Observable<Trajet> {
    return this.http.patch<Trajet>(`${this.base}/admin/trajets/${id}/assigner`, input);
  }

  changerStatutTrajet(id: string, input: SetStatutTrajetInput): Observable<Trajet> {
    return this.http.patch<Trajet>(`${this.base}/admin/trajets/${id}/statut`, input);
  }
}
