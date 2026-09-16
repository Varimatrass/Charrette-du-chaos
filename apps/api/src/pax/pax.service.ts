import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Pax } from "@prisma/client";
import type { PaxOverview, PaxSubmissionResult } from "@desordre/shared-types";
import { DEFAULT_FRONTEND_URL, ENV } from "../common/constants";
import { omitKeys, omitUndefined } from "../common/utils/objects";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaxDto } from "./dto/create-pax.dto";
import { UpdatePaxDto } from "./dto/update-pax.dto";

/** Vue d'un pax sans son jeton d'accès (tout ce qui n'est pas back-office). */
export type PublicPax = Omit<Pax, "accessToken">;

/** Champs exposés aux autres paxs de l'évènement : jamais de coordonnées ni de jeton. */
const PAX_OVERVIEW_SELECT = {
  id: true,
  name: true,
  discordHandle: true,
  comment: true,
  hasVehicle: true,
  vehicleLendingMode: true,
  hasDrivingLicense: true,
  willingToDriveShuttle: true,
} as const;

/** Retire le jeton d'accès d'un pax avant de le renvoyer. */
export function toPublicPax<T extends Pax>(pax: T): Omit<T, "accessToken"> {
  return omitKeys(pax, ["accessToken"]);
}

@Injectable()
export class PaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreatePaxDto): Promise<PaxSubmissionResult> {
    const pax = await this.prisma.pax.create({ data: dto });
    return this.toSubmissionResult(pax);
  }

  async update(pax: Pax, dto: UpdatePaxDto): Promise<PublicPax> {
    const updated = await this.prisma.pax.update({
      where: { id: pax.id },
      data: omitUndefined(dto),
    });
    return toPublicPax(updated);
  }

  /** "Mon espace" : le pax avec ses trajets et, pour chacun, la navette éventuellement assignée. */
  async findMine(pax: Pax) {
    const withTrips = await this.prisma.pax.findUnique({
      where: { id: pax.id },
      include: { trips: { include: { shuttle: true } } },
    });
    if (!withTrips) throw new NotFoundException("Pax introuvable");
    return toPublicPax(withTrips);
  }

  /** Back-office : inclut le jeton, pour renvoyer un lien perdu. */
  findAllForEvent(eventId: string): Promise<Pax[]> {
    return this.prisma.pax.findMany({ where: { eventId }, orderBy: { name: "asc" } });
  }

  /** Back-office : recherche insensible à la casse sur une partie du nom. */
  search(eventId: string, name: string): Promise<Pax[]> {
    return this.prisma.pax.findMany({
      where: { eventId, name: { contains: name, mode: "insensitive" } },
      orderBy: { name: "asc" },
    });
  }

  async findOneAdmin(id: string): Promise<Pax> {
    const pax = await this.prisma.pax.findUnique({ where: { id } });
    if (!pax) throw new NotFoundException("Pax introuvable");
    return pax;
  }

  /**
   * Vue "annuaire" des paxs de l'évènement, telle que vue par les autres
   * paxs : jamais l'email, le téléphone ou le jeton d'accès de qui que ce
   * soit — juste de quoi se coordonner (nom, discord, véhicule/permis/conduite).
   * Champs sélectionnés explicitement plutôt que filtrés après coup, pour
   * qu'un futur champ sensible ajouté à Pax ne fuite pas ici par défaut.
   */
  findAllForEventOverview(eventId: string): Promise<PaxOverview[]> {
    return this.prisma.pax.findMany({
      where: { eventId },
      select: PAX_OVERVIEW_SELECT,
      orderBy: { name: "asc" },
    });
  }

  buildPersonalLink(accessToken: string): string {
    const frontendUrl = this.config.get<string>(ENV.FRONTEND_URL) ?? DEFAULT_FRONTEND_URL;
    return `${frontendUrl.replace(/\/$/, "")}/mon-espace/${accessToken}`;
  }

  private toSubmissionResult(pax: Pax): PaxSubmissionResult {
    return {
      pax: { id: pax.id, name: pax.name },
      accessToken: pax.accessToken,
      personalLink: this.buildPersonalLink(pax.accessToken),
    };
  }
}
