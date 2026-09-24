import { Component } from "@angular/core";
import { TripsTableComponent } from "../../../shared/tables/trips-table.component";
import { TableContext } from "../../../shared/tables/table-role";
import { injectEventId } from "./event-id";

@Component({
  selector: "app-admin-trips-page",
  standalone: true,
  imports: [TripsTableComponent],
  template: `
    <h1>Trajets / demandes</h1>
    <app-trips-table [context]="context" />
  `,
})
export class AdminTripsPageComponent {
  readonly context: TableContext = { role: "admin", eventId: injectEventId() };
}
