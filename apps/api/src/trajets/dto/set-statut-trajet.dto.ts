import { IsEnum } from "class-validator";
import { StatutTrajet } from "@desordre/shared-types";
import type { SetStatutTrajetInput } from "@desordre/shared-types";

export class SetStatutTrajetDto implements SetStatutTrajetInput {
  @IsEnum(StatutTrajet)
  statut!: StatutTrajet;
}
