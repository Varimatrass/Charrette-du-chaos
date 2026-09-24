import { IsUUID, ValidateIf } from "class-validator";
import type { SetMyShuttleInput } from "@desordre/shared-types";

/**
 * Un pax se met (ou se retire, `null`) dans une navette de son évènement.
 * Le champ est obligatoire : `null` est accepté, mais pas son absence.
 */
export class SetMyShuttleDto implements SetMyShuttleInput {
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  shuttleId!: string | null;
}
