import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CarpoolRole, Direction, TripStatus, WaitLevel } from "@desordre/shared-types";
import { CarsService } from "../cars/cars.service.js";
import { ShuttlesService } from "../shuttles/shuttles.service.js";
import { StationsService } from "../stations/stations.service.js";
import {
  CAR_ID,
  EVENT_ID,
  makeCar,
  makePax,
  makeShuttle,
  makeStation,
  makeTrip,
  SHUTTLE_ID,
  STATION_ID,
  TRIP_ID,
} from "../testing/fixtures.js";
import { asPrismaService, createPrismaMock } from "../testing/prisma-mock.js";
import { statusAfterPaxEdit, TripsService } from "./trips.service.js";

describe("statusAfterPaxEdit", () => {
  it("flags an assigned trip for re-check when the pax edits it", () => {
    expect(statusAfterPaxEdit(TripStatus.ASSIGNED)).toBe(TripStatus.TO_RECHECK);
  });

  it("leaves the other statuses untouched", () => {
    expect(statusAfterPaxEdit(TripStatus.PENDING)).toBe(TripStatus.PENDING);
    expect(statusAfterPaxEdit(TripStatus.TO_RECHECK)).toBe(TripStatus.TO_RECHECK);
  });
});

/** Champs "mode" tous vides, tels qu'écrits pour un trajet sans train ni covoit. */
const NO_MODE_FIELDS = {
  stationId: null,
  origin: null,
  carpoolRole: null,
  carId: null,
  lookingForCarpool: false,
};

describe("TripsService", () => {
  const prisma = createPrismaMock();
  const stations = new StationsService(asPrismaService(prisma));
  const cars = new CarsService(asPrismaService(prisma));
  const shuttles = new ShuttlesService(asPrismaService(prisma));
  const service = new TripsService(asPrismaService(prisma), stations, cars, shuttles);
  const pax = makePax();

  beforeEach(() => vi.clearAllMocks());

  describe("upsertMine", () => {
    it("creates a PENDING trip with explicit nulls for undecided fields", async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      prisma.trip.create.mockResolvedValue(makeTrip());

      await service.upsertMine(pax, Direction.OUTBOUND, { mode: "OTHER", time: "08:05" });

      expect(prisma.trip.findUnique).toHaveBeenCalledWith({
        where: { paxId_direction: { paxId: pax.id, direction: Direction.OUTBOUND } },
      });
      expect(prisma.trip.create).toHaveBeenCalledWith({
        data: {
          mode: "OTHER",
          day: null,
          time: "08:05",
          comment: null,
          ...NO_MODE_FIELDS,
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
      prisma.station.findUnique.mockResolvedValue(makeStation());

      await service.upsertMine(pax, Direction.OUTBOUND, {
        mode: "TRAIN",
        day: "2026-09-18",
        stationId: STATION_ID,
      });

      expect(prisma.trip.create).not.toHaveBeenCalled();
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: {
          mode: "TRAIN",
          day: new Date("2026-09-18"),
          time: null,
          comment: null,
          ...NO_MODE_FIELDS,
          stationId: STATION_ID,
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
          data: expect.objectContaining({
            mode: null,
            stationId: null,
            status: TripStatus.PENDING,
          }),
        }),
      );
    });

    describe("train", () => {
      it("creates the station on the fly when a new name is given", async () => {
        prisma.trip.findUnique.mockResolvedValue(null);
        prisma.trip.create.mockResolvedValue(makeTrip());
        prisma.station.findUnique.mockResolvedValue(null);
        prisma.station.findUniqueOrThrow.mockResolvedValue(
          makeStation({ id: "new-station", name: "Gare Neuve" }),
        );

        await service.upsertMine(pax, Direction.OUTBOUND, {
          mode: "TRAIN",
          stationName: "Gare Neuve",
        });

        expect(prisma.station.createMany).toHaveBeenCalledWith({
          data: [{ eventId: pax.eventId, name: "Gare Neuve" }],
          skipDuplicates: true,
        });
        expect(prisma.trip.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ stationId: "new-station" }) }),
        );
      });

      it("refuses a station from another event", async () => {
        prisma.trip.findUnique.mockResolvedValue(null);
        prisma.station.findUnique.mockResolvedValue(makeStation({ eventId: "other" }));
        await expect(
          service.upsertMine(pax, Direction.OUTBOUND, { mode: "TRAIN", stationId: STATION_ID }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe("carpool", () => {
      beforeEach(() => {
        prisma.trip.findUnique.mockResolvedValue(null);
        prisma.trip.create.mockResolvedValue(makeTrip());
      });

      it("a driver is linked to their own car", async () => {
        prisma.car.findUnique.mockResolvedValue(makeCar({ ownerPaxId: pax.id }));
        await service.upsertMine(pax, Direction.OUTBOUND, {
          mode: "CARPOOL",
          carpoolRole: CarpoolRole.DRIVER,
          origin: " Melun ",
        });
        expect(prisma.trip.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              origin: "Melun",
              carpoolRole: CarpoolRole.DRIVER,
              carId: CAR_ID,
              lookingForCarpool: false,
              stationId: null,
            }),
          }),
        );
      });

      it("a driver without a declared car is refused", async () => {
        prisma.car.findUnique.mockResolvedValue(null);
        await expect(
          service.upsertMine(pax, Direction.OUTBOUND, {
            mode: "CARPOOL",
            carpoolRole: CarpoolRole.DRIVER,
          }),
        ).rejects.toThrow(/Déclare d'abord ta voiture/);
      });

      it("a passenger with a car takes a seat in it (after the seat check)", async () => {
        const spy = vi.spyOn(cars, "ensureSeatAvailable").mockResolvedValue(makeCar());
        await service.upsertMine(pax, Direction.RETURN, {
          mode: "CARPOOL",
          carpoolRole: CarpoolRole.PASSENGER,
          carId: CAR_ID,
        });
        // Dans la transaction qui écrit le trajet, pour que le contrôle tienne.
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(pax, CAR_ID, Direction.RETURN, prisma);
        expect(prisma.trip.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              carpoolRole: CarpoolRole.PASSENGER,
              carId: CAR_ID,
              lookingForCarpool: false,
            }),
          }),
        );
      });

      it("a passenger without a car is looking for a carpool", async () => {
        await service.upsertMine(pax, Direction.OUTBOUND, {
          mode: "CARPOOL",
          carpoolRole: CarpoolRole.PASSENGER,
        });
        expect(prisma.trip.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              carpoolRole: CarpoolRole.PASSENGER,
              carId: null,
              lookingForCarpool: true,
            }),
          }),
        );
      });

      it("switching to train clears the carpool fields", async () => {
        prisma.trip.findUnique.mockResolvedValue(
          makeTrip({ mode: "CARPOOL", carpoolRole: "PASSENGER", carId: CAR_ID }),
        );
        prisma.trip.update.mockResolvedValue(makeTrip());
        await service.upsertMine(pax, Direction.OUTBOUND, { mode: "TRAIN" });
        expect(prisma.trip.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              carpoolRole: null,
              carId: null,
              lookingForCarpool: false,
            }),
          }),
        );
      });
    });
  });

  describe("setMyShuttle", () => {
    const shuttleWithSeats = (tripsCount: number, overrides = {}) => ({
      ...makeShuttle({ capacity: 2, ...overrides }),
      _count: { trips: tripsCount },
    });

    it("puts the pax's own trip into a shuttle with a free seat", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.shuttle.findUnique.mockResolvedValue(shuttleWithSeats(1));
      prisma.trip.update.mockResolvedValue(makeTrip({ shuttleId: SHUTTLE_ID }));
      await service.setMyShuttle(pax, Direction.OUTBOUND, { shuttleId: SHUTTLE_ID });
      // Le comptage des places se fait sous verrou de la navette, dans la transaction.
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalledBefore(prisma.shuttle.findUnique);
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: TRIP_ID },
        data: { shuttleId: SHUTTLE_ID, status: TripStatus.ASSIGNED },
      });
    });

    it("refuses a full shuttle, unless the pax is already in it", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.shuttle.findUnique.mockResolvedValue(shuttleWithSeats(2));
      await expect(
        service.setMyShuttle(pax, Direction.OUTBOUND, { shuttleId: SHUTTLE_ID }),
      ).rejects.toThrow(/pleine/);

      prisma.trip.findUnique.mockResolvedValue(makeTrip({ shuttleId: SHUTTLE_ID }));
      prisma.trip.update.mockResolvedValue(makeTrip());
      await expect(
        service.setMyShuttle(pax, Direction.OUTBOUND, { shuttleId: SHUTTLE_ID }),
      ).resolves.toBeDefined();
    });

    it("refuses a shuttle going the other way or from another event", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.shuttle.findUnique.mockResolvedValue(shuttleWithSeats(0, { direction: "RETURN" }));
      await expect(
        service.setMyShuttle(pax, Direction.OUTBOUND, { shuttleId: SHUTTLE_ID }),
      ).rejects.toThrow(/sens/);
      prisma.shuttle.findUnique.mockResolvedValue(shuttleWithSeats(0, { eventId: "other" }));
      await expect(
        service.setMyShuttle(pax, Direction.OUTBOUND, { shuttleId: SHUTTLE_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    it("lets the pax leave the shuttle with null", async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ shuttleId: SHUTTLE_ID, status: "ASSIGNED" }),
      );
      prisma.trip.update.mockResolvedValue(makeTrip());
      await service.setMyShuttle(pax, Direction.OUTBOUND, { shuttleId: null });
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: TRIP_ID },
        data: { shuttleId: null, status: TripStatus.PENDING },
      });
    });

    it("requires the trip to exist first", async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      await expect(
        service.setMyShuttle(pax, Direction.OUTBOUND, { shuttleId: SHUTTLE_ID }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAllForEvent", () => {
    it("adds the wait level for trips assigned to a shuttle, null otherwise, with optional filters", async () => {
      prisma.trip.findMany.mockResolvedValue([
        {
          ...makeTrip({ time: "07:50" }),
          pax,
          station: makeStation(),
          shuttle: { stationArrivalTime: "08:25" },
        },
        { ...makeTrip({ id: "other", shuttleId: null }), pax, station: null, shuttle: null },
      ]);

      const result = await service.findAllForEvent(
        EVENT_ID,
        TripStatus.ASSIGNED,
        Direction.OUTBOUND,
      );

      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: EVENT_ID, status: TripStatus.ASSIGNED, direction: Direction.OUTBOUND },
        }),
      );
      expect(result[0]?.waitLevel).toBe(WaitLevel.MEDIUM);
      expect(result[0]).not.toHaveProperty("shuttle");
      expect(result[1]?.waitLevel).toBeNull();
    });
  });

  describe("findAllForEventOverview", () => {
    it("exposes names, station, car and shuttle labels but no comment or contact details", async () => {
      const trip = makeTrip({
        comment: "interne",
        shuttleId: SHUTTLE_ID,
        carId: CAR_ID,
        carpoolRole: "PASSENGER",
        origin: "Melun",
      });
      prisma.trip.findMany.mockResolvedValue([
        {
          ...trip,
          pax: { id: pax.id, name: pax.name },
          station: { name: "Gare de Testville" },
          car: { name: "Twingo" },
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
        stationId: STATION_ID,
        stationName: "Gare de Testville",
        status: trip.status,
        shuttleId: SHUTTLE_ID,
        shuttleLabel: "Matin",
        origin: "Melun",
        carpoolRole: "PASSENGER",
        carId: CAR_ID,
        carName: "Twingo",
        lookingForCarpool: false,
        waitLevel: WaitLevel.OK,
      });
      expect(overview).not.toHaveProperty("comment");
    });
  });

  describe("assign", () => {
    it("assigns a shuttle of the same event and direction and sets the status to ASSIGNED", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.shuttle.findUnique.mockResolvedValue({ ...makeShuttle(), _count: { trips: 0 } });
      prisma.trip.update.mockResolvedValue(makeTrip());
      await service.assign(TRIP_ID, { shuttleId: SHUTTLE_ID });
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: TRIP_ID },
        data: { shuttleId: SHUTTLE_ID, status: TripStatus.ASSIGNED },
      });
    });

    it("refuses a shuttle going the other way (the admin may still overbook)", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.shuttle.findUnique.mockResolvedValue({
        ...makeShuttle({ direction: "RETURN" }),
        _count: { trips: 0 },
      });
      await expect(service.assign(TRIP_ID, { shuttleId: SHUTTLE_ID })).rejects.toThrow(/sens/);
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
});
