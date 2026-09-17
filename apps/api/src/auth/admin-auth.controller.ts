import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard.js";

/**
 * Permet au frontend de vérifier une clé organisateur·ice sans détourner
 * une route métier : 200 si la clé est acceptée par AdminGuard, 401 sinon.
 */
@UseGuards(AdminGuard)
@Controller("admin/auth")
export class AdminAuthController {
  @Get()
  check(): { ok: true } {
    return { ok: true };
  }
}
