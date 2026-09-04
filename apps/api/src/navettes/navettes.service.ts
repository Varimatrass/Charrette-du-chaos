import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Sens } from '@desordre/shared-types';
import { calculerNiveauAttente } from '../common/attente.util';
import { CreateNavetteDto } from './dto/create-navette.dto';
import { UpdateNavetteDto } from './dto/update-navette.dto';

@Injectable()
export class NavettesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateNavetteDto) {
    return this.prisma.navette.create({
      data: {
        eventId: dto.eventId,
        libelle: dto.libelle,
        jour: new Date(dto.jour),
        sens: dto.sens,
        conducteur: dto.conducteur,
        vehicule: dto.vehicule,
        heureDepart: dto.heureDepart,
        heureArriveeGare: dto.heureArriveeGare,
        heureRetourLieu: dto.heureRetourLieu,
        capacite: dto.capacite,
        commentaire: dto.commentaire,
      },
    });
  }

  async findAllForEvent(eventId: string) {
    const navettes = await this.prisma.navette.findMany({
      where: { eventId },
      include: { trajets: true },
      orderBy: [{ jour: 'asc' }, { heureDepart: 'asc' }],
    });

    return navettes.map(({ trajets, ...navette }) => ({
      ...navette,
      placesRestantes: navette.capacite - trajets.length,
    }));
  }

  /**
   * Planning pour les paxs : mêmes navettes que `findAllForEvent`, mais avec
   * en plus les noms de leurs co-passager·es (jamais l'email/téléphone —
   * voir le commentaire sur `PassagerNom` dans shared-types). Dans un
   * évènement en autogestion, savoir qui conduit et qui est dans la navette
   * est utile aux paxs ; leurs coordonnées de contact restent privées entre
   * elleux.
   */
  async findAllForEventPourPax(eventId: string) {
    const navettes = await this.prisma.navette.findMany({
      where: { eventId },
      include: { trajets: { include: { pax: { select: { id: true, nom: true } } } } },
      orderBy: [{ jour: 'asc' }, { heureDepart: 'asc' }],
    });

    return navettes.map(({ trajets, ...navette }) => ({
      ...navette,
      placesRestantes: navette.capacite - trajets.length,
      passagers: trajets.map((trajet) => ({ paxId: trajet.pax.id, nom: trajet.pax.nom })),
    }));
  }

  async findOne(id: string) {
    const navette = await this.prisma.navette.findUnique({
      where: { id },
      include: { trajets: { include: { pax: true } } },
    });
    if (!navette) throw new NotFoundException('Navette introuvable');

    const { trajets, ...rest } = navette;
    const passagers = trajets.map((trajet) => ({
      ...trajet,
      niveauAttente: calculerNiveauAttente(
        // Voir commentaire équivalent dans trajets.service.ts : cast sûr, même schéma Prisma.
        trajet.sens as unknown as Sens,
        trajet.heure,
        navette.heureArriveeGare,
      ),
    }));

    return {
      ...rest,
      passagers,
      placesRestantes: navette.capacite - trajets.length,
    };
  }

  async update(id: string, dto: UpdateNavetteDto) {
    await this.ensureExists(id);
    return this.prisma.navette.update({
      where: { id },
      data: {
        ...(dto.libelle !== undefined && { libelle: dto.libelle }),
        ...(dto.jour !== undefined && { jour: new Date(dto.jour) }),
        ...(dto.sens !== undefined && { sens: dto.sens }),
        ...(dto.conducteur !== undefined && { conducteur: dto.conducteur }),
        ...(dto.vehicule !== undefined && { vehicule: dto.vehicule }),
        ...(dto.heureDepart !== undefined && { heureDepart: dto.heureDepart }),
        ...(dto.heureArriveeGare !== undefined && {
          heureArriveeGare: dto.heureArriveeGare,
        }),
        ...(dto.heureRetourLieu !== undefined && {
          heureRetourLieu: dto.heureRetourLieu,
        }),
        ...(dto.capacite !== undefined && { capacite: dto.capacite }),
        ...(dto.commentaire !== undefined && { commentaire: dto.commentaire }),
      },
    });
  }

  private async ensureExists(id: string) {
    const navette = await this.prisma.navette.findUnique({ where: { id } });
    if (!navette) throw new NotFoundException('Navette introuvable');
    return navette;
  }
}
