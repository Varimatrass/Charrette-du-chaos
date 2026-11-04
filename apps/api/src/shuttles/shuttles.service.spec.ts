import { ConflictException, NotFoundException } from "@nestjs/common";
import { WaitLevel } from "@desordre/shared-types";
import {
  EVENT_ID,
  makePax,
  makeShuttle,
  makeTrip,
  OTHER_PAX_ID,
  PAX_ID,
  SHUTTLE_ID,
} from "../testing/fixtures.js";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock.js";
import { findIncompatiblePassengers, remainingSeats, ShuttlesService } from "./shuttles.service.js";

describe("remainingSeats", () => {
  it("is capacity minus assigned trips", () => {
    expect(remainingSeats(4, 1)).toBe(3);
    expect(remainingSeats(4, 4)).toBe(0);
  });
});

describe("ShuttlesService", () => {
  const prisma = createPrismaMock();
  const service = new ShuttlesService(asPrismaService(prisma));

  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("converts the day and treats an empty driverPaxId as 'no driver yet'", async () => {
      prisma.shuttle.create.mockResolvedValue(makeShuttle());
      await service.create({
        eventId: EVENT_ID,
        label: "Matin",
        day: "2026-09-18",
        direction: "OUTBOUND",
        departureTime: "08:00",
        stationArrivalTime: "08:25",
        capacity: 4,
        driverPaxId: "",
      });
      expect(prisma.shuttle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          day: new Date("2026-09-18"),
          driverPaxId: null,
          label: "Matin",
        }),
      });
    });
  });

  describe("findAllForEvent", () => {
    it("computes remaining seats from the trip count", async () => {
      prisma.shuttle.findMany.mockResolvedValue([
        { ...makeShuttle({ capacity: 4 }), _count: { trips: 3 } },
      ]);
      const [shuttle] = await service.findAllForEvent(EVENT_ID);
      expect(shuttle?.remainingSeats).toBe(1);
      expect(shuttle).not.toHaveProperty("_count");
    });
  });

  describe("findAllForEventAsPax", () => {
    const shuttleWithPassengers = {
      ...makeShuttle({ driverPaxId: OTHER_PAX_ID }),
      trips: [{ pax: { id: PAX_ID, name: "Alix" } }, { pax: { id: OTHER_PAX_ID, name: "Bilal" } }],
      driverPax: { id: OTHER_PAX_ID, name: "Bilal", contactPhone: "0600000009" },
    };

    it("lists passenger names only, never their contact details", async () => {
      prisma.shuttle.findMany.mockResolvedValue([shuttleWithPassengers]);
      const [shuttle] = await service.findAllForEventAsPax(EVENT_ID, "someone-else");
      expect(shuttle?.passengers).toEqual([
        { paxId: PAX_ID, name: "Alix" },
        { paxId: OTHER_PAX_ID, name: "Bilal" },
      ]);
      expect(shuttle?.remainingSeats).toBe(2);
      expect(shuttle).not.toHaveProperty("trips");
      expect(shuttle?.driverPax).toEqual({ id: OTHER_PAX_ID, name: "Bilal" });
      expect(JSON.stringify(shuttle)).not.toContain("0600000009");
    });

    it("shows the driver's phone only to the passengers of that shuttle", async () => {
      prisma.shuttle.findMany.mockResolvedValue([shuttleWithPassengers]);
      const [forPassenger] = await service.findAllForEventAsPax(EVENT_ID, PAX_ID);
      const [forOutsider] = await service.findAllForEventAsPax(EVENT_ID, "someone-else");
      expect(forPassenger?.driverContactPhone).toBe("0600000009");
      expect(forOutsider?.driverContactPhone).toBeNull();
    });

    it("has no phone to show when no pax is linked as driver", async () => {
      prisma.shuttle.findMany.mockResolvedValue([{ ...shuttleWithPassengers, driverPax: null }]);
      const [shuttle] = await service.findAllForEventAsPax(EVENT_ID, PAX_ID);
      expect(shuttle?.driverContactPhone).toBeNull();
    });
  });

  describe("findOne", () => {
    it("returns passengers with their wait level and the remaining seats", async () => {
      const pax = makePax();
      prisma.shuttle.findUnique.mockResolvedValue({
        ...makeShuttle({ stationArrivalTime: "08:25", capacity: 4 }),
        trips: [{ ...makeTrip({ time: "07:20" }), pax }],
      });
      const shuttle = await service.findOne(SHUTTLE_ID);
      expect(shuttle.remainingSeats).toBe(3);
      expect(shuttle.passengers[0]?.waitLevel).toBe(WaitLevel.HIGH);
      expect(shuttle.passengers[0]?.pax).toBe(pax);
    });

    it("throws a 404 for an unknown shuttle", async () => {
      prisma.shuttle.findUnique.mockResolvedValue(null);
      await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    beforeEach(() => {
      prisma.shuttle.findUnique.mockResolvedValue({ ...makeShuttle(), trips: [] });
      prisma.shuttle.update.mockResolvedValue(makeShuttle());
      prisma.pax.findUnique.mockResolvedValue({ eventId: EVENT_ID });
    });

    it("only touches provided fields and clears the ones sent as null", async () => {
      await service.update(SHUTTLE_ID, { label: "Nouveau", vehicle: null, day: "2026-09-19" });
      expect(prisma.shuttle.update).toHaveBeenCalledWith({
        where: { id: SHUTTLE_ID },
        data: { label: "Nouveau", vehicle: null, day: new Date("2026-09-19") },
      });
    });

    it("maps an empty driverPaxId to null (unlink) instead of an invalid foreign key", async () => {
      await service.update(SHUTTLE_ID, { driverPaxId: "" });
      expect(prisma.shuttle.update).toHaveBeenCalledWith({
        where: { id: SHUTTLE_ID },
        data: { driverPaxId: null },
      });
    });

    it("throws a 404 for an unknown shuttle", async () => {
      prisma.shuttle.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { label: "x" })).rejects.toThrow(NotFoundException);
      expect(prisma.shuttle.update).not.toHaveBeenCalled();
    });

    it("answers 409 with the incompatible passengers instead of saving (B5)", async () => {
      prisma.shuttle.findUnique.mockResolvedValue({
        ...makeShuttle(),
        trips: [passenger("t1", "Alix", null)],
      });
      await expect(service.update(SHUTTLE_ID, { direction: "RETURN" })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.shuttle.update).not.toHaveBeenCalled();
    });

    it("removes the incompatible passengers when confirmed", async () => {
      prisma.shuttle.findUnique.mockResolvedValue({
        ...makeShuttle(),
        trips: [passenger("t1", "Alix", null)],
      });
      prisma.$transaction.mockResolvedValueOnce([{ count: 1 }, makeShuttle()]);
      await service.update(SHUTTLE_ID, { direction: "RETURN", removeIncompatible: true });
      expect(prisma.trip.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["t1"] } },
        data: { shuttleId: null, shuttleAssignedAt: null, status: "PENDING" },
      });
      expect(prisma.shuttle.update).toHaveBeenCalledWith({
        where: { id: SHUTTLE_ID },
        data: { direction: "RETURN" },
      });
    });
  });

  describe("findIncompatiblePassengers", () => {
    const base = {
      direction: "OUTBOUND" as const,
      day: new Date("2026-09-18"),
      capacity: 3,
      trips: [
        passenger("early", "Alix", new Date("2026-09-01T10:00:00Z")),
        passenger("late", "Bilal", new Date("2026-09-03T10:00:00Z")),
        passenger("middle", "Kim", new Date("2026-09-02T10:00:00Z"), new Date("2026-09-19")),
      ],
    };

    it("is empty when nothing relevant changes", () => {
      expect(findIncompatiblePassengers(base, { capacity: 3 })).toEqual([]);
      expect(findIncompatiblePassengers(base, { day: new Date("2026-09-18") })).toEqual([]);
    });

    it("flags everybody when the direction changes", () => {
      expect(
        findIncompatiblePassengers(base, { direction: "RETURN" }).map((p) => p.reason),
      ).toEqual(["DIRECTION", "DIRECTION", "DIRECTION"]);
    });

    it("flags passengers travelling another day when the day changes (unknown days are fine)", () => {
      const result = findIncompatiblePassengers(
        { ...base, trips: [...base.trips, passenger("noday", "Jo", null, null)] },
        { day: new Date("2026-09-19") },
      );
      expect(result).toEqual([
        { tripId: "early", paxName: "Alix", reason: "DAY" },
        { tripId: "late", paxName: "Bilal", reason: "DAY" },
      ]);
    });

    it("flags the last ones in when the capacity drops below the passenger count", () => {
      expect(findIncompatiblePassengers(base, { capacity: 1 })).toEqual([
        { tripId: "late", paxName: "Bilal", reason: "CAPACITY" },
        { tripId: "middle", paxName: "Kim", reason: "CAPACITY" },
      ]);
    });
  });
});

function passenger(
  id: string,
  name: string,
  assignedAt: Date | null,
  day: Date | null = new Date("2026-09-18"),
) {
  return { id, day, shuttleAssignedAt: assignedAt, pax: { name } };
}
