import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type {
  CreateEventInput,
  CreateStationInput,
  EventWithStations,
  Station,
  UpdateEventInput,
} from "@desordre/shared-types";
import { apiUrl } from "./api-base";

/** Évènements et leurs gares : lecture publique, écriture back-office. */
@Injectable({ providedIn: "root" })
export class EventsApiService {
  private readonly http = inject(HttpClient);

  /** Seulement les évènements ouverts aux paxs (page d'accueil). */
  listOpen(): Observable<EventWithStations[]> {
    return this.http.get<EventWithStations[]>(apiUrl("events"));
  }

  /** Tous les évènements, ouverts ou pas (back-office). */
  listAll(): Observable<EventWithStations[]> {
    return this.http.get<EventWithStations[]>(apiUrl("admin/events"));
  }

  get(id: string): Observable<EventWithStations> {
    return this.http.get<EventWithStations>(apiUrl(`events/${id}`));
  }

  listStations(eventId: string): Observable<Station[]> {
    return this.http.get<Station[]>(apiUrl(`events/${eventId}/stations`));
  }

  create(input: CreateEventInput): Observable<EventWithStations> {
    return this.http.post<EventWithStations>(apiUrl("admin/events"), input);
  }

  update(id: string, input: UpdateEventInput): Observable<EventWithStations> {
    return this.http.patch<EventWithStations>(apiUrl(`admin/events/${id}`), input);
  }

  addStation(eventId: string, input: CreateStationInput): Observable<Station> {
    return this.http.post<Station>(apiUrl(`admin/events/${eventId}/stations`), input);
  }

  removeStation(eventId: string, stationId: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`admin/events/${eventId}/stations/${stationId}`));
  }
}
