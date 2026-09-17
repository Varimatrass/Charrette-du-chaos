import { IsIn, IsOptional, IsUUID } from "class-validator";
import { TripStatus } from "@desordre/shared-types";

/** Query string de GET /admin/trips : évènement obligatoire, filtre de statut facultatif. */
export class ListTripsQueryDto {
  @IsUUID()
  eventId!: string;

  @IsOptional()
  @IsIn(Object.values(TripStatus))
  status?: TripStatus;
}
