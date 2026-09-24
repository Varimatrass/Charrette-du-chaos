import { IsUUID, ValidateIf } from "class-validator";
import type { AssignTripInput } from "@desordre/shared-types";

/** `shuttleId: null` désassigne le trajet ; le champ est obligatoire (pas d'absence). */
export class AssignTripDto implements AssignTripInput {
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  shuttleId!: string | null;
}
