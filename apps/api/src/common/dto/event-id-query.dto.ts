import { IsUUID } from "class-validator";

/** Query string `?eventId=<uuid>` commune aux listes du back-office. */
export class EventIdQueryDto {
  @IsUUID()
  eventId!: string;
}
