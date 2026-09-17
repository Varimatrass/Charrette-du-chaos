import type { Mocked } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EVENT_ID, makePax, makeShuttle, makeTrip } from "../testing/fixtures.js";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock.js";
import { PaxService, toPublicPax } from "./pax.service.js";

describe("toPublicPax", () => {
  it("strips the access token and nothing else", () => {
    const pax = makePax();
    const result = toPublicPax(pax);
    expect(result).not.toHaveProperty("accessToken");
    expect(result).toMatchObject({ id: pax.id, name: pax.name, contactEmail: pax.contactEmail });
  });
});

describe("PaxService", () => {
  const prisma = createPrismaMock();
  const config = { get: vi.fn() } as unknown as Mocked<ConfigService>;
  const service = new PaxService(asPrismaService(prisma), config);

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue(undefined);
  });

  describe("create", () => {
    it("returns the token and the personal link exactly once, at creation", async () => {
      const pax = makePax();
      prisma.pax.create.mockResolvedValue(pax);
      config.get.mockReturnValue("https://navettes.example/");

      const result = await service.create({ eventId: EVENT_ID, name: pax.name });

      expect(result).toEqual({
        pax: { id: pax.id, name: pax.name },
        accessToken: pax.accessToken,
        personalLink: `https://navettes.example/mon-espace/${pax.accessToken}`,
      });
    });

    it("falls back to the dev frontend URL when FRONTEND_URL is not set", async () => {
      const pax = makePax();
      prisma.pax.create.mockResolvedValue(pax);
      const result = await service.create({ eventId: EVENT_ID, name: pax.name });
      expect(result.personalLink).toBe(`http://localhost:4200/mon-espace/${pax.accessToken}`);
    });
  });

  describe("update", () => {
    it("ignores absent fields, clears fields sent as null, and hides the token", async () => {
      const pax = makePax();
      prisma.pax.update.mockResolvedValue(makePax({ contactEmail: null, name: "Alix M." }));

      const result = await service.update(pax, { name: "Alix M.", contactEmail: null });

      expect(prisma.pax.update).toHaveBeenCalledWith({
        where: { id: pax.id },
        data: { name: "Alix M.", contactEmail: null },
      });
      expect(result).not.toHaveProperty("accessToken");
      expect(result.contactEmail).toBeNull();
    });
  });

  describe("findMine", () => {
    it("returns the pax with trips and assigned shuttles, without the token", async () => {
      const pax = makePax();
      const trip = { ...makeTrip(), shuttle: makeShuttle() };
      prisma.pax.findUnique.mockResolvedValue({ ...pax, trips: [trip] });

      const result = await service.findMine(pax);

      expect(result).not.toHaveProperty("accessToken");
      expect(result.trips).toEqual([trip]);
      expect(prisma.pax.findUnique).toHaveBeenCalledWith({
        where: { id: pax.id },
        include: { trips: { include: { shuttle: true } } },
      });
    });

    it("throws a 404 if the pax vanished between the guard and the query", async () => {
      prisma.pax.findUnique.mockResolvedValue(null);
      await expect(service.findMine(makePax())).rejects.toThrow(NotFoundException);
    });
  });

  describe("search", () => {
    it("searches case-insensitively on a name fragment, scoped to the event", async () => {
      prisma.pax.findMany.mockResolvedValue([]);
      await service.search(EVENT_ID, "ali");
      expect(prisma.pax.findMany).toHaveBeenCalledWith({
        where: { eventId: EVENT_ID, name: { contains: "ali", mode: "insensitive" } },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("findAllForEventOverview", () => {
    it("selects only non-sensitive fields (no email, phone or token)", async () => {
      prisma.pax.findMany.mockResolvedValue([]);
      await service.findAllForEventOverview(EVENT_ID);
      const call = prisma.pax.findMany.mock.calls[0]?.[0] as { select: Record<string, boolean> };
      expect(Object.keys(call.select).sort()).toEqual(
        [
          "comment",
          "discordHandle",
          "hasDrivingLicense",
          "hasVehicle",
          "id",
          "name",
          "vehicleLendingMode",
          "willingToDriveShuttle",
        ].sort(),
      );
    });
  });
});
