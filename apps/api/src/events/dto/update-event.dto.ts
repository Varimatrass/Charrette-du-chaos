import { PartialType } from "@nestjs/mapped-types";
import type { UpdateEventInput } from "@desordre/shared-types";
import { CreateEventDto } from "./create-event.dto";

export class UpdateEventDto extends PartialType(CreateEventDto) implements UpdateEventInput {}
