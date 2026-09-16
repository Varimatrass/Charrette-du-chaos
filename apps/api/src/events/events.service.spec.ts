import { NotFoundException } from "@nestjs/common";
import { EVENT_ID, makeEvent } from "../testing/fixtures";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock";
import { EventsService } from "./events.service";

describe("EventsService", () => {
  const prisma = createPrismaMock();
  const service = new EventsService(asPrismaService(prisma));

  beforeEach(() => jest.clearAllMocks());

  it("creates an event with real Date objects for the date columns", async () => {
    prisma.event.create.mockResolvedValue(makeEvent());
    await service.create({
      name: "Été 2026",
      startDate: "2026-09-18",
      endDate: "2026-09-20",
      location: "Ferme",
      referenceStation: "Gare",
    });
    expect(prisma.event.create).toHaveBeenCalledWith({
      data: {
        name: "Été 2026",
        startDate: new Date("2026-09-18"),
        endDate: new Date("2026-09-20"),
        location: "Ferme",
        referenceStation: "Gare",
      },
    });
  });

  it("lists events most recent first", async () => {
    prisma.event.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(prisma.event.findMany).toHaveBeenCalledWith({ orderBy: { startDate: "desc" } });
  });

  it("throws a 404 for an unknown event", async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });

  it("only updates the fields that are provided", async () => {
    prisma.event.findUnique.mockResolvedValue(makeEvent());
    prisma.event.update.mockResolvedValue(makeEvent({ name: "Nouveau nom" }));

    await service.update(EVENT_ID, { name: "Nouveau nom", endDate: "2026-09-21" });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { name: "Nouveau nom", endDate: new Date("2026-09-21") },
    });
  });

  it("refuses to update an unknown event", async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(service.update("missing", { name: "x" })).rejects.toThrow(NotFoundException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });
});
