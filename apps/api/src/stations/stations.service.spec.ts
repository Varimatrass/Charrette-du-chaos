import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EVENT_ID, makeStation, STATION_ID } from "../testing/fixtures.js";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock.js";
import { normalizeStationName, StationsService } from "./stations.service.js";

describe("normalizeStationName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeStationName("  Gare   de  Lyon ")).toBe("Gare de Lyon");
  });
});

describe("StationsService", () => {
  const prisma = createPrismaMock();
  const service = new StationsService(asPrismaService(prisma));

  beforeEach(() => vi.clearAllMocks());

  describe("findOrCreate", () => {
    it("returns the existing station when the (normalised) name is already known", async () => {
      const station = makeStation();
      prisma.station.findUnique.mockResolvedValue(station);
      expect(await service.findOrCreate(EVENT_ID, " Gare de Testville ")).toBe(station);
      expect(prisma.station.findUnique).toHaveBeenCalledWith({
        where: { eventId_name: { eventId: EVENT_ID, name: "Gare de Testville" } },
      });
      expect(prisma.station.create).not.toHaveBeenCalled();
    });

    it("creates the station otherwise", async () => {
      prisma.station.findUnique.mockResolvedValue(null);
      prisma.station.create.mockResolvedValue(makeStation({ name: "Nouvelle" }));
      await service.findOrCreate(EVENT_ID, "Nouvelle");
      expect(prisma.station.create).toHaveBeenCalledWith({
        data: { eventId: EVENT_ID, name: "Nouvelle" },
      });
    });

    it("rejects an empty name", async () => {
      await expect(service.findOrCreate(EVENT_ID, "   ")).rejects.toThrow(BadRequestException);
    });
  });

  describe("ensureInEvent", () => {
    it("rejects a station of another event", async () => {
      prisma.station.findUnique.mockResolvedValue(makeStation({ eventId: "other" }));
      await expect(service.ensureInEvent(EVENT_ID, STATION_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("remove", () => {
    it("deletes a station of the event", async () => {
      prisma.station.findUnique.mockResolvedValue(makeStation());
      await service.remove(EVENT_ID, STATION_ID);
      expect(prisma.station.delete).toHaveBeenCalledWith({ where: { id: STATION_ID } });
    });

    it("throws a 404 for a station of another event", async () => {
      prisma.station.findUnique.mockResolvedValue(makeStation({ eventId: "other" }));
      await expect(service.remove(EVENT_ID, STATION_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
