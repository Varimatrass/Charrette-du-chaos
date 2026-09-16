import { IsNotEmpty, IsString, IsUUID } from "class-validator";
import type { SearchPaxQuery } from "@desordre/shared-types";

export class SearchPaxDto implements SearchPaxQuery {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}
