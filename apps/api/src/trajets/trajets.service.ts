import { Injectable, NotFoundException } from "@nestjs/common";
import type { Pax, Trajet } from "@prisma/client";
import { Sens, StatutTrajet } from "@desordre/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { calculerNiveauAttente } from "../common/attente.util";
import { AssignerTrajetDto } from "./dto/assigner-trajet.dto";
import { SetStatutTrajetDto } from "./dto/set-statut-trajet.dto";
import { UpsertTrajetDto } from "./dto/upsert-trajet.dto";

@Injectable()
export class TrajetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour le trajet (aller ou retour) du pax connecté.
   * Jamais bloquant : un pax peut revenir autant de fois qu'il veut, ajouter
   * le retour plus tard, changer d'avis à la dernière minute...
   * Si le trajet était déjà assigné à une navette, on ne casse pas
   * l'assignation mais on la marque "à revérifier" pour l'organisateur·ice.
   */
  async upsertMine(pax: Pax, sens: Sens, dto: UpsertTrajetDto): Promise<Trajet> {
    const existant = await this.prisma.trajet.findUnique({
      where: { paxId_sens: { paxId: pax.id, sens } },
    });

    const donneesCommunes = {
      mode: dto.mode,
      jour: dto.jour ? new Date(dto.jour) : null,
      heure: dto.heure ?? null,
      gare: dto.gare ?? null,
      commentaire: dto.commentaire ?? null,
    };

    if (!existant) {
      return this.prisma.trajet.create({
        data: {
          ...donneesCommunes,
          sens,
          eventId: pax.eventId,
          paxId: pax.id,
          statut: StatutTrajet.EN_ATTENTE,
        },
      });
    }

    const statutApresModif = existant.statut === StatutTrajet.ASSIGNE ? StatutTrajet.A_REVERIFIER : existant.statut;

    return this.prisma.trajet.update({
      where: { id: existant.id },
      data: { ...donneesCommunes, statut: statutApresModif },
    });
  }

  async findAllForEvent(eventId: string, statut?: StatutTrajet) {
    const trajets = await this.prisma.trajet.findMany({
      where: { eventId, ...(statut && { statut }) },
      include: { pax: true, navette: true },
      orderBy: [{ jour: "asc" }, { heure: "asc" }],
    });

    return trajets.map(({ navette, ...trajet }) => ({
      ...trajet,
      niveauAttente: navette ? calculerNiveauAttente(
          // Le client Prisma génère son propre enum `Sens` (structurellement identique
          // à celui de shared-types mais nominalement distinct pour TypeScript) : cast
          // sûr car les valeurs viennent du même schéma Prisma qui définit "ALLER"/"RETOUR".
          trajet.sens as unknown as Sens,
          trajet.heure,
          navette.heureArriveeGare,
        ) : null,
    }));
  }

  async assigner(id: string, dto: AssignerTrajetDto) {
    await this.findOneOrThrow(id);
    return this.prisma.trajet.update({
      where: { id },
      data: {
        navetteId: dto.navetteId,
        statut: dto.navetteId ? StatutTrajet.ASSIGNE : StatutTrajet.EN_ATTENTE,
      },
    });
  }

  async setStatut(id: string, dto: SetStatutTrajetDto) {
    await this.findOneOrThrow(id);
    return this.prisma.trajet.update({ where: { id }, data: { statut: dto.statut } });
  }

  private async findOneOrThrow(id: string) {
    const trajet = await this.prisma.trajet.findUnique({ where: { id } });
    if (!trajet) throw new NotFoundException("Trajet introuvable");
    return trajet;
  }
}
