import { Component } from "@angular/core";
import { ShuttlesTableComponent } from "../../../shared/tables/shuttles-table.component";
import { TableContext } from "../../../shared/tables/table-role";
import { injectEventId } from "./event-id";

@Component({
  selector: "app-admin-shuttles-page",
  standalone: true,
  imports: [ShuttlesTableComponent],
  template: `
    <h1>Navettes</h1>
    <app-shuttles-table [context]="context" />
  `,
})
export class AdminShuttlesPageComponent {
  readonly context: TableContext = { role: "admin", eventId: injectEventId() };
}
