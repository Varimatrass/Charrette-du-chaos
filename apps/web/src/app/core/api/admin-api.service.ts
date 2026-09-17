import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type {
  AssignTripInput,
  Car,
  CarOverview,
  CreateShuttleInput,
  Direction,
  DriverAvailabilitySlotWithPax,
  PaxAdmin,
  Shuttle as ShuttleModel,
  Station,
  SetTripStatusInput,
  Shuttle,
  ShuttleWithPassengers,
  ShuttleWithRemainingSeats,
  Trip,
  TripStatus,
  TripWithPax,
  UpdateShuttleInput,
} from "@desordre/shared-types";
import { ADMIN_KEY_HEADER, apiUrl } from "./api-base";

/** Un pax vu du back-office, avec sa voiture et ses trajets (navette, gare, voiture liées). */
export type PaxAdminWithTrips = PaxAdmin & {
  car: Car | null;
  trips: (Trip & { shuttle: ShuttleModel | null; station: Station | null; car: Car | null })[];
};

/**
 * Back-office organisateur·ice : toutes ces routes sont sous `/admin/`, la
 * clé est ajoutée automatiquement par `adminKeyInterceptor`.
 */
@Injectable({ providedIn: "root" })
export class AdminApiService {
  private readonly http = inject(HttpClient);

  /**
   * Vérifie une clé avant de la mémoriser : on l'envoie explicitement (elle
   * n'est pas encore stockée, donc l'intercepteur ne peut pas l'ajouter).
   */
  checkKey(key: string): Observable<{ ok: true }> {
    return this.http.get<{ ok: true }>(apiUrl("admin/auth"), {
      headers: { [ADMIN_KEY_HEADER]: key },
    });
  }

  // ---- Pax ----

  listPaxs(eventId: string): Observable<PaxAdminWithTrips[]> {
    return this.http.get<PaxAdminWithTrips[]>(apiUrl("admin/pax"), { params: { eventId } });
  }

  // ---- Voitures ----

  listCars(eventId: string): Observable<CarOverview[]> {
    return this.http.get<CarOverview[]>(apiUrl("admin/cars"), { params: { eventId } });
  }

  searchPaxs(eventId: string, name: string): Observable<PaxAdmin[]> {
    return this.http.get<PaxAdmin[]>(apiUrl("admin/pax/search"), { params: { eventId, name } });
  }

  // ---- Disponibilités conducteur·ice ----

  /** Pour proposer en priorité, à la création/modification d'une navette, les pax déjà partant·es. */
  listAvailabilitySlots(eventId: string): Observable<DriverAvailabilitySlotWithPax[]> {
    return this.http.get<DriverAvailabilitySlotWithPax[]>(apiUrl("admin/availability-slots"), {
      params: { eventId },
    });
  }

  // ---- Navettes ----

  listShuttles(eventId: string): Observable<ShuttleWithRemainingSeats[]> {
    return this.http.get<ShuttleWithRemainingSeats[]>(apiUrl("admin/shuttles"), {
      params: { eventId },
    });
  }

  getShuttle(id: string): Observable<ShuttleWithPassengers> {
    return this.http.get<ShuttleWithPassengers>(apiUrl(`admin/shuttles/${id}`));
  }

  createShuttle(input: CreateShuttleInput): Observable<Shuttle> {
    return this.http.post<Shuttle>(apiUrl("admin/shuttles"), input);
  }

  updateShuttle(id: string, input: UpdateShuttleInput): Observable<Shuttle> {
    return this.http.patch<Shuttle>(apiUrl(`admin/shuttles/${id}`), input);
  }

  // ---- Trajets ----

  listTrips(eventId: string, filters: { status?: TripStatus; direction?: Direction } = {}) {
    const params: Record<string, string> = { eventId };
    if (filters.status) params["status"] = filters.status;
    if (filters.direction) params["direction"] = filters.direction;
    return this.http.get<TripWithPax[]>(apiUrl("admin/trips"), { params });
  }

  assignTrip(id: string, input: AssignTripInput): Observable<Trip> {
    return this.http.patch<Trip>(apiUrl(`admin/trips/${id}/assign`), input);
  }

  setTripStatus(id: string, input: SetTripStatusInput): Observable<Trip> {
    return this.http.patch<Trip>(apiUrl(`admin/trips/${id}/status`), input);
  }
}
