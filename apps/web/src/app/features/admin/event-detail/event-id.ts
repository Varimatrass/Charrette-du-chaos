import { inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

/** L'id d'évènement de la route `admin/events/:id/...` (sur la route ou un de ses parents). */
export function injectEventId(): string {
  let route: ActivatedRoute | null = inject(ActivatedRoute);
  while (route) {
    const id = route.snapshot.paramMap.get("id");
    if (id) return id;
    route = route.parent;
  }
  throw new Error("Pas d'id d'évènement dans la route");
}
