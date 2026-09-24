import { IsIn, IsOptional, IsUUID } from "class-validator";
import { Direction, TripStatus } from "@desordre/shared-types";

/** Query string de GET /admin/trips : évènement obligatoire, filtres facultatifs. */
export class ListTripsQueryDto {
  @IsUUID()
  eventId!: string;

  @IsOptional()
  @IsIn(Object.values(TripStatus))
  status?: TripStatus;

  @IsOptional()
  @IsIn(Object.values(Direction))
  direction?: Direction;
}
