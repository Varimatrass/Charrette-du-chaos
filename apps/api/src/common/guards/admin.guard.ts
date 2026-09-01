import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Garde d'accès au back-office organisateur·ice pour la V1.
 *
 * Volontairement minimaliste : une seule clé partagée (ADMIN_KEY dans
 * l'environnement), envoyée par le frontend dans l'en-tête `x-admin-key`.
 * Pas de vraie liste de comptes pour l'instant (décision produit V1) —
 * ce garde est le seul endroit à remplacer le jour où une authentification
 * par compte est mise en place, sans toucher aux contrôleurs.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header("x-admin-key");
    const expected = this.config.get<string>("ADMIN_KEY");

    if (!expected) {
      // Mal configuré côté serveur : on refuse plutôt que de laisser passer.
      throw new UnauthorizedException("ADMIN_KEY n'est pas configurée côté serveur");
    }

    if (!provided || provided !== expected) {
      throw new UnauthorizedException("Clé organisateur·ice manquante ou invalide");
    }

    return true;
  }
}
