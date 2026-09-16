import { Controller, Get } from "@nestjs/common";

/** Sonde de vie minimale, utilisable par un outil de supervision ou un healthcheck Docker. */
@Controller("health")
export class HealthController {
  @Get()
  check(): { status: "ok" } {
    return { status: "ok" };
  }
}
