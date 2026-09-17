import { IsOptional, IsUUID } from "class-validator";
import type { SetMyShuttleInput } from "@desordre/shared-types";

/** Un pax se met (ou se retire, `null`) dans une navette de son évènement. */
export class SetMyShuttleDto implements SetMyShuttleInput {
  @IsOptional()
  @IsUUID()
  shuttleId!: string | null;
}
