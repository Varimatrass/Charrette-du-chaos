import { Component } from "@angular/core";
import { PaxsTableComponent } from "../../../shared/tables/paxs-table.component";
import { TableContext } from "../../../shared/tables/table-role";
import { injectEventId } from "./event-id";

@Component({
  selector: "app-admin-paxs-page",
  standalone: true,
  imports: [PaxsTableComponent],
  template: `
    <h1>Paxs</h1>
    <app-paxs-table [context]="context" />
  `,
})
export class AdminPaxsPageComponent {
  readonly context: TableContext = { role: "admin", eventId: injectEventId() };
}
