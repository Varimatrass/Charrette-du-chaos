import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { Direction } from "@desordre/shared-types";
import type { CreateShuttleInput } from "@desordre/shared-types";

export class CreateShuttleDto implements CreateShuttleInput {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  day!: string;

  @IsIn(Object.values(Direction))
  direction!: Direction;

  @IsOptional()
  @IsString()
  vehicle?: string;

  @IsString()
  @IsNotEmpty()
  departureTime!: string;

  @IsString()
  @IsNotEmpty()
  stationArrivalTime!: string;

  @IsOptional()
  @IsString()
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
