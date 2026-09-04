import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { VehicleLendingMode } from "@desordre/shared-types";
import type { CreatePaxInput } from "@desordre/shared-types";

export class CreatePaxDto implements CreatePaxInput {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  nom!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactTelephone?: string;

  @IsOptional()
  @IsString()
  discordHandle?: string;

  @IsOptional()
  @IsString()
  commentaire?: string;

  @IsOptional()
  @IsBoolean()
  hasVehicle?: boolean;

  @IsOptional()
  @IsEnum(VehicleLendingMode)
  vehicleLendingMode?: VehicleLendingMode;

  @IsOptional()
  @IsBoolean()
  hasDrivingLicense?: boolean;

  @IsOptional()
  @IsBoolean()
  willingToDriveShuttle?: boolean;
}
