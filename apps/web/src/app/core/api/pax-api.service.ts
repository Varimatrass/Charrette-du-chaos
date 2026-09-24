import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type {
  Car,
  CarOverview,
  CreateDriverAvailabilitySlotInput,
  CreatePaxInput,
  CreateStationInput,
  Direction,
  DriverAvailabilitySlot,
  Pax,
  PaxOverview,
  PaxSubmissionResult,
  PaxWithTrips,
  SetMyShuttleInput,
  ShuttleWithPassengerNames,
  Station,
  Trip,
  TripOverview,
  UpdatePaxInput,
  UpsertCarInput,
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

  /** Se met (ou se retire, `null`) dans une navette non pleine de son évènement, pour son propre trajet. */
  setMyShuttle(token: string, direction: Direction, input: SetMyShuttleInput): Observable<Trip> {
    return this.http.patch<Trip>(apiUrl(`pax/me/trips/${direction}/shuttle`), input, {
      headers: paxTokenHeaders(token),
    });
  }

  /** Déclare ou met à jour sa voiture (une seule par pax). */
  upsertMyCar(token: string, input: UpsertCarInput): Observable<Car> {
    return this.http.put<Car>(apiUrl("pax/me/car"), input, { headers: paxTokenHeaders(token) });
  }

  deleteMyCar(token: string): Observable<void> {
    return this.http.delete<void>(apiUrl("pax/me/car"), { headers: paxTokenHeaders(token) });
  }

  /** Voitures de son évènement, pour choisir celle où l'on a une place. */
  listMyEventCars(token: string): Observable<CarOverview[]> {
    return this.http.get<CarOverview[]>(apiUrl("pax/me/cars"), { headers: paxTokenHeaders(token) });
  }

  /** Ajoute une gare absente de la liste de son évènement. */
  addStation(token: string, input: CreateStationInput): Observable<Station> {
    return this.http.post<Station>(apiUrl("pax/me/stations"), input, {
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
