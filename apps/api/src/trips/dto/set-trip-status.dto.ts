import { IsIn } from "class-validator";
import { TripStatus } from "@desordre/shared-types";
import type { SetTripStatusInput } from "@desordre/shared-types";

export class SetTripStatusDto implements SetTripStatusInput {
  @IsIn(Object.values(TripStatus))
  status!: TripStatus;
}
