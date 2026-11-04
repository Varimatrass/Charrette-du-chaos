import { IsDay, IsTime } from "../../common/validation/date-time.js";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { Direction } from "@desordre/shared-types";
import type { CreateShuttleInput } from "@desordre/shared-types";

export class CreateShuttleDto implements CreateShuttleInput {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsDay()
  day!: string;

  @IsIn(Object.values(Direction))
  direction!: Direction;

  @IsOptional()
  @IsString()
  vehicle?: string;

  @IsTime()
  departureTime!: string;

  @IsTime()
  stationArrivalTime!: string;

  @IsOptional()
  @IsTime()
  venueReturnTime?: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsUUID()
  driverPaxId?: string;
}
