import { IsOptional, IsUUID } from "class-validator";
import type { AssignerTrajetInput } from "@desordre/shared-types";

export class AssignerTrajetDto implements AssignerTrajetInput {
  @IsOptional()
  @IsUUID()
  navetteId!: string | null;
}
