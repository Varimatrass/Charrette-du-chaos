import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { VehicleLendingMode } from "@desordre/shared-types";
import type { UpdatePaxInput } from "@desordre/shared-types";

export class UpdatePaxDto implements UpdatePaxInput {
  @IsOptional()
  @IsString()
  nom?: string;

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
