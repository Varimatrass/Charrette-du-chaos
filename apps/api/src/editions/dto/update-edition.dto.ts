import { PartialType } from "@nestjs/mapped-types";
import type { UpdateEditionInput } from "@desordre/shared-types";
import { CreateEditionDto } from "./create-edition.dto";

export class UpdateEditionDto extends PartialType(CreateEditionDto) implements UpdateEditionInput {}
