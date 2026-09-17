import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { VehicleLendingMode } from "@desordre/shared-types";
import type { CreatePaxInput } from "@desordre/shared-types";

export class CreatePaxDto implements CreatePaxInput {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  discordHandle?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  hasVehicle?: boolean;

  @IsOptional()
  @IsIn(Object.values(VehicleLendingMode))
  vehicleLendingMode?: VehicleLendingMode;

  @IsOptional()
  @IsBoolean()
  hasDrivingLicense?: boolean;

  @IsOptional()
  @IsBoolean()
  willingToDriveShuttle?: boolean;
}
