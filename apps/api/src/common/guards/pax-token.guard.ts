import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { Pax } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface RequestWithPax extends Request {
  pax: Pax;
}

/**
 * Authentifie un pax par son jeton d'accès personnel (en-tête `x-pax-token`),
 * pas par un compte. Le jeton est un UUID non devinable généré à la première
 * saisie (voir Pax.accessToken) — c'est ce qui permet à un pax de revenir
 * modifier ses infos librement, sans jamais bloquer l'accès.
 */
@Injectable()
export class PaxTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPax>();
    const token = request.header("x-pax-token");

    if (!token) {
      throw new UnauthorizedException("Lien personnel manquant (en-tête x-pax-token)");
    }

    const pax = await this.prisma.pax.findUnique({ where: { accessToken: token } });
    if (!pax) {
      throw new UnauthorizedException("Lien personnel invalide ou expiré");
    }

    request.pax = pax;
    return true;
  }
}
