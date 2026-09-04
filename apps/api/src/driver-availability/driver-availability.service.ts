import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Pax } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDriverAvailabilitySlotDto } from "./dto/create-driver-availability-slot.dto";

@Injectable()
export class DriverAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Un pax ajoute un créneau où iel serait dispo pour conduire une navette. */
  createMine(pax: Pax, dto: CreateDriverAvailabilitySlotDto) {
    return this.prisma.driverAvailabilitySlot.create({
      data: {
        eventId: pax.eventId,
        paxId: pax.id,
        day: new Date(dto.day),
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        comment: dto.comment ?? null,
      },
    });
  }

  findMine(pax: Pax) {
    return this.prisma.driverAvailabilitySlot.findMany({
      where: { paxId: pax.id },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });
  }

  async deleteMine(pax: Pax, id: string) {
    const slot = await this.prisma.driverAvailabilitySlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException("Créneau introuvable");
    // Un pax ne peut supprimer que ses propres créneaux, jamais ceux des autres.
    if (slot.paxId !== pax.id) throw new ForbiddenException("Ce créneau n'est pas le vôtre");
    await this.prisma.driverAvailabilitySlot.delete({ where: { id } });
  }

  /** Back-office : tous les créneaux dispo d'un évènement, avec le nom du pax, pour créer les navettes. */
  findAllForEvent(eventId: string) {
    return this.prisma.driverAvailabilitySlot.findMany({
      where: { eventId },
      include: { pax: { select: { id: true, nom: true, contactTelephone: true } } },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });
  }
}
