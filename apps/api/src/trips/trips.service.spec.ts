import { NotFoundException } from "@nestjs/common";
import { Direction, TripStatus, WaitLevel } from "@desordre/shared-types";
import { EVENT_ID, makePax, makeShuttle, makeTrip, SHUTTLE_ID, TRIP_ID } from "../testing/fixtures";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock";
import { statusAfterPaxEdit, TripsService } from "./trips.service";

describe("statusAfterPaxEdit", () => {
  it("flags an assigned trip for re-check when the pax edits it", () => {
    expect(statusAfterPaxEdit(TripStatus.ASSIGNED)).toBe(TripStatus.TO_RECHECK);
  });

  it("leaves the other statuses untouched", () => {
    expect(statusAfterPaxEdit(TripStatus.PENDING)).toBe(TripStatus.PENDING);
    expect(statusAfterPaxEdit(TripStatus.TO_RECHECK)).toBe(TripStatus.TO_RECHECK);
  });
});

describe("TripsService", () => {
  const prisma = createPrismaMock();
  const service = new TripsService(asPrismaService(prisma));
  const pax = makePax();

  beforeEach(() => jest.clearAllMocks());

  describe("upsertMine", () => {
    it("creates a PENDING trip with explicit nulls for undecided fields", async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      prisma.trip.create.mockResolvedValue(makeTrip());

      await service.upsertMine(pax, Direction.OUTBOUND, { mode: "TRAIN", time: "08:05" });

      expect(prisma.trip.findUnique).toHaveBeenCalledWith({
        where: { paxId_direction: { paxId: pax.id, direction: Direction.OUTBOUND } },
      });
      expect(prisma.trip.create).toHaveBeenCalledWith({
        data: {
          mode: "TRAIN",
          day: null,
          time: "08:05",
          station: null,
          comment: null,
          direction: Direction.OUTBOUND,
          eventId: pax.eventId,
          paxId: pax.id,
          status: TripStatus.PENDING,
        },
      });
    });

    it("updates an existing trip and marks an assigned one as TO_RECHECK", async () => {
      const existing = makeTrip({ status: TripStatus.ASSIGNED, shuttleId: SHUTTLE_ID });
      prisma.trip.findUnique.mockResolvedValue(existing);
      prisma.trip.update.mockResolvedValue(existing);

      await service.upsertMine(pax, Direction.OUTBOUND, { mode: "TRAIN", day: "2026-09-18" });

      expect(prisma.trip.create).not.toHaveBeenCalled();
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: {
          mode: "TRAIN",
          day: new Date("2026-09-18"),
          time: null,
          station: null,
          comment: null,
          status: TripStatus.TO_RECHECK,
        },
      });
    });

    it("lets a pax go back to 'undecided' by sending an empty body", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip({ mode: "TRAIN" }));
      prisma.trip.update.mockResolvedValue(makeTrip({ mode: null }));

      await service.upsertMine(pax, Direction.OUTBOUND, {});

      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mode: null, status: TripStatus.PENDING }),
        }),
      );
    });
  });

  describe("findAllForEvent", () => {
    it("adds the wait level for trips assigned to a shuttle, null otherwise", async () => {
      prisma.trip.findMany.mockResolvedValue([
        { ...makeTrip({ time: "07:50" }), pax, shuttle: { stationArrivalTime: "08:25" } },
        { ...makeTrip({ id: "other", shuttleId: null }), pax, shuttle: null },
      ]);

      const result = await service.findAllForEvent(EVENT_ID, TripStatus.ASSIGNED);

      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: EVENT_ID, status: TripStatus.ASSIGNED } }),
      );
      expect(result[0]?.waitLevel).toBe(WaitLevel.MEDIUM);
      expect(result[0]).not.toHaveProperty("shuttle");
      expect(result[1]?.waitLevel).toBeNull();
    });

    it("does not filter by status when none is given", async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.findAllForEvent(EVENT_ID);
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: EVENT_ID } }),
      );
    });
  });

  describe("findAllForEventOverview", () => {
    it("exposes the pax name and shuttle label but no comment or contact details", async () => {
      const trip = makeTrip({ comment: "interne", shuttleId: SHUTTLE_ID });
      prisma.trip.findMany.mockResolvedValue([
        {
          ...trip,
          pax: { id: pax.id, name: pax.name },
          shuttle: { id: SHUTTLE_ID, label: "Matin", stationArrivalTime: "08:25" },
        },
      ]);

      const [overview] = await service.findAllForEventOverview(EVENT_ID);

      expect(overview).toEqual({
        id: trip.id,
        paxId: pax.id,
        paxName: pax.name,
        direction: trip.direction,
        mode: trip.mode,
        day: trip.day,
        time: trip.time,
        station: trip.station,
        status: trip.status,
        shuttleId: SHUTTLE_ID,
        shuttleLabel: "Matin",
        waitLevel: WaitLevel.OK,
      });
      expect(overview).not.toHaveProperty("comment");
    });
  });

  describe("assign", () => {
    it("assigns a shuttle and sets the status to ASSIGNED", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.trip.update.mockResolvedValue(makeTrip());
      await service.assign(TRIP_ID, { shuttleId: SHUTTLE_ID });
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: TRIP_ID },
        data: { shuttleId: SHUTTLE_ID, status: TripStatus.ASSIGNED },
      });
    });

    it("unassigns with null and goes back to PENDING", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip({ shuttleId: SHUTTLE_ID }));
      prisma.trip.update.mockResolvedValue(makeTrip());
      await service.assign(TRIP_ID, { shuttleId: null });
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: TRIP_ID },
        data: { shuttleId: null, status: TripStatus.PENDING },
      });
    });

    it("throws a 404 for an unknown trip", async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      await expect(service.assign("missing", { shuttleId: null })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.trip.update).not.toHaveBeenCalled();
    });
  });

  describe("setStatus", () => {
    it("updates the status of an existing trip", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.trip.update.mockResolvedValue(makeTrip({ status: TripStatus.ASSIGNED }));
      await service.setStatus(TRIP_ID, { status: TripStatus.ASSIGNED });
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: TRIP_ID },
        data: { status: TripStatus.ASSIGNED },
      });
    });
  });

  // Sanity check: the shuttle fixture is what the wait level maths above rely on.
  it("fixture shuttle arrives at the station at 08:25", () => {
    expect(makeShuttle().stationArrivalTime).toBe("08:25");
  });
});
