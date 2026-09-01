import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Pax } from "@prisma/client";
import type { PaxSubmissionResult } from "@desordre/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaxDto } from "./dto/create-pax.dto";
import { UpdatePaxDto } from "./dto/update-pax.dto";

@Injectable()
export class PaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreatePaxDto): Promise<PaxSubmissionResult> {
    const pax = await this.prisma.pax.create({
      data: {
        editionId: dto.editionId,
        nom: dto.nom,
        contactEmail: dto.contactEmail,
        contactTelephone: dto.contactTelephone,
        commentaire: dto.commentaire,
      },
    });

    return this.toSubmissionResult(pax);
  }

  async update(pax: Pax, dto: UpdatePaxDto) {
    const updated = await this.prisma.pax.update({
      where: { id: pax.id },
      data: {
        ...(dto.nom !== undefined && { nom: dto.nom }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.contactTelephone !== undefined && { contactTelephone: dto.contactTelephone }),
        ...(dto.commentaire !== undefined && { commentaire: dto.commentaire }),
      },
    });
    return this.toPublic(updated);
  }

  async findMine(pax: Pax) {
    const withTrajets = await this.prisma.pax.findUnique({
      where: { id: pax.id },
      include: { trajets: { include: { navette: true } } },
    });
    if (!withTrajets) throw new NotFoundException("Pax introuvable");
    const { accessToken: _accessToken, ...rest } = withTrajets;
    return rest;
  }

  /** Vue sans le jeton d'accès, pour toute réponse qui n'a pas besoin de l'exposer à nouveau. */
  private toPublic(pax: Pax) {
    const { accessToken: _accessToken, ...rest } = pax;
    return rest;
  }

  findAllForEdition(editionId: string) {
    return this.prisma.pax.findMany({
      where: { editionId },
      orderBy: { nom: "asc" },
    });
  }

  async rechercher(editionId: string, nom: string) {
    return this.prisma.pax.findMany({
      where: {
        editionId,
        nom: { contains: nom, mode: "insensitive" },
      },
      orderBy: { nom: "asc" },
    });
  }

  async findOneAdmin(id: string) {
    const pax = await this.prisma.pax.findUnique({ where: { id } });
    if (!pax) throw new NotFoundException("Pax introuvable");
    return pax;
  }

  private toSubmissionResult(pax: Pax): PaxSubmissionResult {
    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:4200";
    return {
      pax: { id: pax.id, nom: pax.nom },
      accessToken: pax.accessToken,
      lienPersonnel: `${frontendUrl}/mon-espace/${pax.accessToken}`,
    };
  }
}
