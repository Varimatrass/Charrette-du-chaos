import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { EVENT_ID, makePax, makeSlot, OTHER_PAX_ID, SLOT_ID } from "../testing/fixtures.js";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock.js";
import { DriverAvailabilityService } from "./driver-availability.service.js";

describe("DriverAvailabilityService", () => {
  const prisma = createPrismaMock();
  const service = new DriverAvailabilityService(asPrismaService(prisma));
  const pax = makePax();

  beforeEach(() => vi.clearAllMocks());

  it("creates a slot for the current pax and their event", async () => {
    prisma.driverAvailabilitySlot.create.mockResolvedValue(makeSlot());
    await service.createMine(pax, { day: "2026-09-18", startTime: "09:00" });
    expect(prisma.driverAvailabilitySlot.create).toHaveBeenCalledWith({
      data: {
        eventId: pax.eventId,
        paxId: pax.id,
        day: new Date("2026-09-18"),
        startTime: "09:00",
        endTime: null,
        comment: null,
      },
    });
  });

  it("lists only the current pax's slots", async () => {
    prisma.driverAvailabilitySlot.findMany.mockResolvedValue([]);
    await service.findMine(pax);
    expect(prisma.driverAvailabilitySlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { paxId: pax.id } }),
    );
  });

  describe("deleteMine", () => {
    it("deletes a slot owned by the pax", async () => {
      prisma.driverAvailabilitySlot.findUnique.mockResolvedValue(makeSlot({ paxId: pax.id }));
      await service.deleteMine(pax, SLOT_ID);
      expect(prisma.driverAvailabilitySlot.delete).toHaveBeenCalledWith({ where: { id: SLOT_ID } });
    });

    it("refuses to delete another pax's slot", async () => {
      prisma.driverAvailabilitySlot.findUnique.mockResolvedValue(makeSlot({ paxId: OTHER_PAX_ID }));
      await expect(service.deleteMine(pax, SLOT_ID)).rejects.toThrow(ForbiddenException);
      expect(prisma.driverAvailabilitySlot.delete).not.toHaveBeenCalled();
    });

    it("throws a 404 for an unknown slot", async () => {
      prisma.driverAvailabilitySlot.findUnique.mockResolvedValue(null);
      await expect(service.deleteMine(pax, "missing")).rejects.toThrow(NotFoundException);
    });
  });

  it("lists an event's slots with the pax name and phone for the back-office", async () => {
    prisma.driverAvailabilitySlot.findMany.mockResolvedValue([]);
    await service.findAllForEvent(EVENT_ID);
    expect(prisma.driverAvailabilitySlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: EVENT_ID },
        include: { pax: { select: { id: true, name: true, contactPhone: true } } },
      }),
    );
  });
});
