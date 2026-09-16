import { IsOptional, IsUUID } from "class-validator";
import type { AssignTripInput } from "@desordre/shared-types";

/** `shuttleId: null` désassigne le trajet. */
export class AssignTripDto implements AssignTripInput {
  @IsOptional()
  @IsUUID()
  shuttleId!: string | null;
}
