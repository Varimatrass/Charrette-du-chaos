import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EVENT_ID, makeEvent, makeStation, STATION_ID } from "../testing/fixtures.js";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock.js";
import { EventsService } from "./events.service.js";

const WITH_STATIONS = { stations: { orderBy: { name: "asc" } } };

describe("EventsService", () => {
  const prisma = createPrismaMock();
  const service = new EventsService(asPrismaService(prisma));

  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("creates the event with its stations and makes the first one preferred", async () => {
      const created = {
        ...makeEvent({ preferredStationId: null }),
        stations: [makeStation({ name: "Gare A" }), makeStation({ id: "b", name: "Gare B" })],
      };
      prisma.event.create.mockResolvedValue(created);
      prisma.event.update.mockResolvedValue({ ...created, preferredStationId: STATION_ID });

      const result = await service.create({
        name: "Été 2026",
        startDate: "2026-09-18",
        endDate: "2026-09-20",
        location: "Ferme",
        stations: ["Gare A", " Gare B ", "Gare A"],
      });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: {
          name: "Été 2026",
          startDate: new Date("2026-09-18"),
          endDate: new Date("2026-09-20"),
          location: "Ferme",
          stations: { create: [{ name: "Gare A" }, { name: "Gare B" }] },
        },
        include: WITH_STATIONS,
      });
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { preferredStationId: STATION_ID },
        include: WITH_STATIONS,
      });
      expect(result.preferredStationId).toBe(STATION_ID);
    });

    it("works without any station", async () => {
      prisma.event.create.mockResolvedValue({
        ...makeEvent({ preferredStationId: null }),
        stations: [],
      });
      await service.create({
        name: "x",
        startDate: "2026-09-18",
        endDate: "2026-09-20",
        location: "y",
      });
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  it("lists only open events publicly, most recent first", async () => {
    prisma.event.findMany.mockResolvedValue([]);
    await service.findOpen();
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { openToPaxs: true },
      orderBy: { startDate: "desc" },
      include: WITH_STATIONS,
    });
  });

  it("lists every event for the back-office", async () => {
    prisma.event.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      orderBy: { startDate: "desc" },
      include: WITH_STATIONS,
    });
  });

  it("throws a 404 for an unknown event", async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });

  describe("update", () => {
    const existing = { ...makeEvent(), stations: [makeStation()] };

    it("only updates the fields that are provided", async () => {
      prisma.event.findUnique.mockResolvedValue(existing);
      prisma.event.update.mockResolvedValue(existing);

      await service.update(EVENT_ID, {
        name: "Nouveau nom",
        endDate: "2026-09-21",
        openToPaxs: true,
      });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { name: "Nouveau nom", endDate: new Date("2026-09-21"), openToPaxs: true },
        include: WITH_STATIONS,
      });
    });

    it("accepts a preferred station of the event, or null to clear it", async () => {
      prisma.event.findUnique.mockResolvedValue(existing);
      prisma.event.update.mockResolvedValue(existing);
      await service.update(EVENT_ID, { preferredStationId: STATION_ID });
      await service.update(EVENT_ID, { preferredStationId: null });
      expect(prisma.event.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { preferredStationId: null } }),
      );
    });

    it("refuses a preferred station from another event", async () => {
      prisma.event.findUnique.mockResolvedValue(existing);
      await expect(service.update(EVENT_ID, { preferredStationId: "other" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("refuses to update an unknown event", async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { name: "x" })).rejects.toThrow(NotFoundException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });
});
