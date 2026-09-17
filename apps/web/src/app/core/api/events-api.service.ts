import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import type { CreateEventInput, Event, UpdateEventInput } from "@desordre/shared-types";
import { apiUrl } from "./api-base";

/** Évènements : lecture publique, écriture back-office. */
@Injectable({ providedIn: "root" })
export class EventsApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<Event[]> {
    return this.http.get<Event[]>(apiUrl("events"));
  }

  get(id: string): Observable<Event> {
    return this.http.get<Event>(apiUrl(`events/${id}`));
  }

  create(input: CreateEventInput): Observable<Event> {
    return this.http.post<Event>(apiUrl("admin/events"), input);
  }

  update(id: string, input: UpdateEventInput): Observable<Event> {
    return this.http.patch<Event>(apiUrl(`admin/events/${id}`), input);
  }
}
