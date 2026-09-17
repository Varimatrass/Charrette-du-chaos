import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CAR_ID, EVENT_ID, makeCar, makePax, OTHER_PAX_ID, PAX_ID } from "../testing/fixtures.js";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock.js";
import { CarsService, toCarOverview } from "./cars.service.js";

const carWithTrips = (seats = 1) => ({
  ...makeCar({ seats, ownerPaxId: OTHER_PAX_ID }),
  ownerPax: { id: OTHER_PAX_ID, name: "Bilal" },
  trips: [
    {
      direction: "OUTBOUND" as const,
      carpoolRole: "DRIVER" as const,
      pax: { id: OTHER_PAX_ID, name: "Bilal" },
    },
    {
      direction: "OUTBOUND" as const,
      carpoolRole: "PASSENGER" as const,
      pax: { id: "p3", name: "Camille" },
    },
  ],
});

describe("toCarOverview", () => {
  it("counts only passengers (not the driver) per direction", () => {
    const overview = toCarOverview(carWithTrips(3));
    expect(overview.owner).toEqual({ id: OTHER_PAX_ID, name: "Bilal" });
    expect(overview.passengers.OUTBOUND).toEqual([{ paxId: "p3", name: "Camille" }]);
    expect(overview.passengers.RETURN).toEqual([]);
    expect(overview.remainingSeats).toEqual({ OUTBOUND: 2, RETURN: 3 });
  });
});

describe("CarsService", () => {
  const prisma = createPrismaMock();
  const service = new CarsService(asPrismaService(prisma));
  const pax = makePax();

  beforeEach(() => vi.clearAllMocks());

  it("upserts the pax's single car", async () => {
    prisma.car.upsert.mockResolvedValue(makeCar());
    await service.upsertMine(pax, { name: "Twingo", seats: 3, lendingMode: "NOT_AVAILABLE" });
    expect(prisma.car.upsert).toHaveBeenCalledWith({
      where: { ownerPaxId: pax.id },
      create: {
        eventId: pax.eventId,
        ownerPaxId: pax.id,
        name: "Twingo",
        seats: 3,
        lendingMode: "NOT_AVAILABLE",
      },
      update: { name: "Twingo", seats: 3, lendingMode: "NOT_AVAILABLE" },
    });
  });

  describe("deleteMine", () => {
    it("deletes the car and puts its passengers back to 'looking for a carpool'", async () => {
      prisma.car.findUnique.mockResolvedValue(makeCar({ ownerPaxId: pax.id }));
      prisma.$transaction.mockResolvedValue([]);
      await service.deleteMine(pax);
      expect(prisma.trip.updateMany).toHaveBeenCalledWith({
        where: { carId: CAR_ID, carpoolRole: "PASSENGER" },
        data: { lookingForCarpool: true },
      });
      expect(prisma.car.delete).toHaveBeenCalledWith({ where: { id: CAR_ID } });
    });

    it("throws a 404 when the pax has no car", async () => {
      prisma.car.findUnique.mockResolvedValue(null);
      await expect(service.deleteMine(pax)).rejects.toThrow(NotFoundException);
    });
  });

  describe("ensureSeatAvailable", () => {
    it("accepts a car of the event with a free seat", async () => {
      prisma.car.findUnique.mockResolvedValue(carWithTrips(2));
      await expect(service.ensureSeatAvailable(pax, CAR_ID, "OUTBOUND")).resolves.toBeDefined();
    });

    it("rejects a full car, unless the pax is already in it", async () => {
      prisma.car.findUnique.mockResolvedValue(carWithTrips(1));
      await expect(service.ensureSeatAvailable(pax, CAR_ID, "OUTBOUND")).rejects.toThrow(/pleine/);
      await expect(
        service.ensureSeatAvailable(makePax({ id: "p3" }), CAR_ID, "OUTBOUND"),
      ).resolves.toBeDefined();
      await expect(service.ensureSeatAvailable(pax, CAR_ID, "RETURN")).resolves.toBeDefined();
    });

    it("rejects one's own car and cars from another event", async () => {
      prisma.car.findUnique.mockResolvedValue({ ...carWithTrips(3), ownerPaxId: PAX_ID });
      await expect(service.ensureSeatAvailable(pax, CAR_ID, "OUTBOUND")).rejects.toThrow(
        /propre voiture/,
      );
      prisma.car.findUnique.mockResolvedValue({ ...carWithTrips(3), eventId: "other" });
      await expect(service.ensureSeatAvailable(pax, CAR_ID, "OUTBOUND")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  it("lists the event's cars as overviews", async () => {
    prisma.car.findMany.mockResolvedValue([carWithTrips(3)]);
    const [overview] = await service.findAllForEventOverview(EVENT_ID);
    expect(overview?.remainingSeats.OUTBOUND).toBe(2);
    expect(prisma.car.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: EVENT_ID } }),
    );
  });
});
