import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type {
  CreateDriverAvailabilitySlotInput,
  CreatePaxInput,
  Direction,
  DriverAvailabilitySlot,
  Pax,
  PaxOverview,
  PaxSubmissionResult,
  PaxWithTrips,
  ShuttleWithPassengerNames,
  Trip,
  TripOverview,
  UpdatePaxInput,
  UpsertTripInput,
} from "@desordre/shared-types";
import { apiUrl, paxTokenHeaders } from "./api-base";

/**
 * Parcours pax : inscription publique puis auto-service avec le jeton
 * personnel (routes `/pax/me/...`, en-tête x-pax-token).
 */
@Injectable({ providedIn: "root" })
export class PaxApiService {
  private readonly http = inject(HttpClient);

  register(input: CreatePaxInput): Observable<PaxSubmissionResult> {
    return this.http.post<PaxSubmissionResult>(apiUrl("pax"), input);
  }

  getMySpace(token: string): Observable<PaxWithTrips> {
    return this.http.get<PaxWithTrips>(apiUrl("pax/me"), { headers: paxTokenHeaders(token) });
  }

  updateMyInfo(token: string, input: UpdatePaxInput): Observable<Pax> {
    return this.http.patch<Pax>(apiUrl("pax/me"), input, { headers: paxTokenHeaders(token) });
  }

  upsertMyTrip(token: string, direction: Direction, input: UpsertTripInput): Observable<Trip> {
    return this.http.put<Trip>(apiUrl(`pax/me/trips/${direction}`), input, {
      headers: paxTokenHeaders(token),
    });
  }

  /** Planning des navettes de son évènement (lecture seule, avec noms des co-passager·es). */
  listMyEventShuttles(token: string): Observable<ShuttleWithPassengerNames[]> {
    return this.http.get<ShuttleWithPassengerNames[]>(apiUrl("pax/me/shuttles"), {
      headers: paxTokenHeaders(token),
    });
  }

  /** Annuaire des paxs de son évènement (lecture seule, jamais leurs coordonnées). */
  listMyEventPaxs(token: string): Observable<PaxOverview[]> {
    return this.http.get<PaxOverview[]>(apiUrl("pax/me/paxs"), { headers: paxTokenHeaders(token) });
  }

  /** Tous les trajets de son évènement (lecture seule, jamais les coordonnées des autres paxs). */
  listMyEventTrips(token: string): Observable<TripOverview[]> {
    return this.http.get<TripOverview[]>(apiUrl("pax/me/trips"), {
      headers: paxTokenHeaders(token),
    });
  }

  listMyAvailabilitySlots(token: string): Observable<DriverAvailabilitySlot[]> {
    return this.http.get<DriverAvailabilitySlot[]>(apiUrl("pax/me/availability-slots"), {
      headers: paxTokenHeaders(token),
    });
  }

  addMyAvailabilitySlot(
    token: string,
    input: CreateDriverAvailabilitySlotInput,
  ): Observable<DriverAvailabilitySlot> {
    return this.http.post<DriverAvailabilitySlot>(apiUrl("pax/me/availability-slots"), input, {
      headers: paxTokenHeaders(token),
    });
  }

  deleteMyAvailabilitySlot(token: string, id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`pax/me/availability-slots/${id}`), {
      headers: paxTokenHeaders(token),
    });
  }
}
