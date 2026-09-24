import { factories } from "./support/factories.js";
import { createTestApp, TestApp } from "./support/test-app.js";

describe("Trips (e2e)", () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let eventId: string;
  let token: string;
  let paxId: string;
  let stationId: string;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.prisma);
  });
  beforeEach(async () => {
    await t.resetDatabase();
    eventId = (await make.event()).id;
    stationId = (await make.station(eventId)).id;
    const pax = await make.pax(eventId);
    token = pax.accessToken;
    paxId = pax.id;
  });
  afterAll(() => t.close());

  describe("PUT /pax/me/trips/:direction", () => {
    it("creates a PENDING trip on first call, then updates it (never duplicates)", async () => {
      const first = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "TRAIN", day: "2026-09-18", time: "08:05", stationId })
        .expect(200);
      expect(first.body).toMatchObject({
        direction: "OUTBOUND",
        status: "PENDING",
        time: "08:05",
        paxId,
        eventId,
        stationId,
      });

      const second = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "TRAIN", time: "09:05" })
        .expect(200);
      expect(second.body.id).toBe(first.body.id);
      // Les champs non renvoyés repassent explicitement à null ("pas encore décidé").
      expect(second.body).toMatchObject({ time: "09:05", day: null, stationId: null });
      expect(await t.prisma.trip.count()).toBe(1);
    });

    it("accepts an empty body ('je sais pas encore')", async () => {
      const { body } = await t
        .http()
        .put("/pax/me/trips/RETURN")
        .set(t.asPax(token))
        .send({})
        .expect(200);
      expect(body).toMatchObject({ direction: "RETURN", mode: null, status: "PENDING" });
    });

    it("marks an assigned trip as TO_RECHECK when the pax edits it, keeping the shuttle", async () => {
      const shuttle = await make.shuttle(eventId);
      await make.trip(eventId, paxId, { shuttleId: shuttle.id, status: "ASSIGNED" });

      const { body } = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "TRAIN", time: "10:00" })
        .expect(200);
      expect(body).toMatchObject({ status: "TO_RECHECK", shuttleId: shuttle.id });
    });

    it("rejects an unknown direction, mode or field", async () => {
      await t.http().put("/pax/me/trips/SIDEWAYS").set(t.asPax(token)).send({}).expect(400);
      await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "BUS" })
        .expect(400);
      await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ status: "ASSIGNED" })
        .expect(400);
    });

    it("requires a pax token", async () => {
      await t.http().put("/pax/me/trips/OUTBOUND").send({}).expect(401);
    });

    it("creates a new station on the fly when the pax types one", async () => {
      const { body } = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "TRAIN", stationName: "  Gare  Neuve " })
        .expect(200);
      const stations = await t.prisma.station.findMany({
        where: { eventId },
        orderBy: { name: "asc" },
      });
      expect(stations.map((s) => s.name)).toEqual(["Gare Neuve", "Gare de Testville"]);
      expect(body.stationId).toBe(stations[0]?.id);

      // Le même nom retapé réutilise la gare au lieu d'en créer une deuxième.
      await t
        .http()
        .put("/pax/me/trips/RETURN")
        .set(t.asPax(token))
        .send({ mode: "TRAIN", stationName: "Gare Neuve" })
        .expect(200);
      expect(await t.prisma.station.count({ where: { eventId } })).toBe(2);
    });

    it("refuses a station from another event", async () => {
      const other = await make.event({ name: "Autre" });
      const foreign = await make.station(other.id, { name: "Ailleurs" });
      await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "TRAIN", stationId: foreign.id })
        .expect(400);
    });
  });

  describe("carpool", () => {
    it("a driver needs a declared car, then is linked to it", async () => {
      await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "CARPOOL", carpoolRole: "DRIVER", origin: "Melun" })
        .expect(400);

      const car = await t
        .http()
        .put("/pax/me/car")
        .set(t.asPax(token))
        .send({ name: "Twingo verte", seats: 2, lendingMode: "ONLY_IF_OWNER_DRIVES" })
        .expect(200);
      expect(car.body).toMatchObject({
        name: "Twingo verte",
        seats: 2,
        ownerPaxId: paxId,
        eventId,
      });

      const { body } = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "CARPOOL", carpoolRole: "DRIVER", origin: "Melun" })
        .expect(200);
      expect(body).toMatchObject({
        carpoolRole: "DRIVER",
        carId: car.body.id,
        origin: "Melun",
        lookingForCarpool: false,
      });
    });

    it("never overbooks a car when several paxs take the last seat at once", async () => {
      const driver = await make.pax(eventId, { name: "Bilal" });
      const car = await make.car(eventId, driver.id, { seats: 1 });
      const paxs = await Promise.all(
        ["A", "B", "C", "D", "E"].map((name) => make.pax(eventId, { name })),
      );

      const responses = await Promise.all(
        paxs.map((pax) =>
          t
            .http()
            .put("/pax/me/trips/OUTBOUND")
            .set(t.asPax(pax.accessToken))
            .send({ mode: "CARPOOL", carpoolRole: "PASSENGER", carId: car.id }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 400, 400, 400, 400]);
      expect(await t.prisma.trip.count({ where: { carId: car.id } })).toBe(1);
    });

    it("a passenger picks a car with a free seat, or is looking for one", async () => {
      const driver = await make.pax(eventId, { name: "Bilal" });
      const car = await make.car(eventId, driver.id, { seats: 1 });

      const looking = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "CARPOOL", carpoolRole: "PASSENGER", origin: "Paris" })
        .expect(200);
      expect(looking.body).toMatchObject({
        carpoolRole: "PASSENGER",
        carId: null,
        lookingForCarpool: true,
      });

      const seated = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "CARPOOL", carpoolRole: "PASSENGER", carId: car.id })
        .expect(200);
      expect(seated.body).toMatchObject({ carId: car.id, lookingForCarpool: false });

      // La voiture (1 place) est maintenant pleine à l'aller pour quelqu'un d'autre...
      const other = await make.pax(eventId, { name: "Camille" });
      await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(other.accessToken))
        .send({ mode: "CARPOOL", carpoolRole: "PASSENGER", carId: car.id })
        .expect(400);
      // ...mais pas au retour.
      await t
        .http()
        .put("/pax/me/trips/RETURN")
        .set(t.asPax(other.accessToken))
        .send({ mode: "CARPOOL", carpoolRole: "PASSENGER", carId: car.id })
        .expect(200);

      const cars = await t.http().get("/pax/me/cars").set(t.asPax(token)).expect(200);
      expect(cars.body).toHaveLength(1);
      expect(cars.body[0]).toMatchObject({
        id: car.id,
        owner: { id: driver.id, name: "Bilal" },
        remainingSeats: { OUTBOUND: 0, RETURN: 0 },
      });
      expect(cars.body[0].passengers.OUTBOUND).toEqual([{ paxId, name: "Alix Moreau" }]);
    });

    it("deleting one's car sends its passengers back to 'looking for a carpool'", async () => {
      await t
        .http()
        .put("/pax/me/car")
        .set(t.asPax(token))
        .send({ name: "Twingo", seats: 3, lendingMode: "NOT_AVAILABLE" })
        .expect(200);
      const myCar = await t.prisma.car.findUniqueOrThrow({ where: { ownerPaxId: paxId } });
      const passenger = await make.pax(eventId, { name: "Camille" });
      await make.trip(eventId, passenger.id, {
        mode: "CARPOOL",
        carpoolRole: "PASSENGER",
        carId: myCar.id,
      });

      await t.http().delete("/pax/me/car").set(t.asPax(token)).expect(204);
      await t.http().delete("/pax/me/car").set(t.asPax(token)).expect(404);

      const trip = await t.prisma.trip.findFirstOrThrow({ where: { paxId: passenger.id } });
      expect(trip).toMatchObject({
        carId: null,
        lookingForCarpool: true,
        carpoolRole: "PASSENGER",
      });
    });
  });

  describe("PATCH /pax/me/trips/:direction/shuttle (self-assignment)", () => {
    it("lets a pax join a shuttle with a free seat, and leave it", async () => {
      const shuttle = await make.shuttle(eventId, { capacity: 1 });
      await make.trip(eventId, paxId);

      const joined = await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(token))
        .send({ shuttleId: shuttle.id })
        .expect(200);
      expect(joined.body).toMatchObject({ shuttleId: shuttle.id, status: "ASSIGNED" });

      // Pleine pour les autres, pas pour celui qui y est déjà.
      const other = await make.pax(eventId, { name: "Camille" });
      await make.trip(eventId, other.id);
      await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(other.accessToken))
        .send({ shuttleId: shuttle.id })
        .expect(400);
      await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(token))
        .send({ shuttleId: shuttle.id })
        .expect(200);

      const left = await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(token))
        .send({ shuttleId: null })
        .expect(200);
      expect(left.body).toMatchObject({ shuttleId: null, status: "PENDING" });
    });

    it("never overbooks a shuttle when several paxs take the last seat at once", async () => {
      const shuttle = await make.shuttle(eventId, { capacity: 1 });
      const paxs = await Promise.all(
        ["A", "B", "C", "D", "E"].map((name) => make.pax(eventId, { name })),
      );
      await Promise.all(paxs.map((pax) => make.trip(eventId, pax.id)));

      const responses = await Promise.all(
        paxs.map((pax) =>
          t
            .http()
            .patch("/pax/me/trips/OUTBOUND/shuttle")
            .set(t.asPax(pax.accessToken))
            .send({ shuttleId: shuttle.id }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 400, 400, 400, 400]);
      expect(await t.prisma.trip.count({ where: { shuttleId: shuttle.id } })).toBe(1);
    });

    it("rejects a body without shuttleId (null is required to leave)", async () => {
      await make.trip(eventId, paxId);
      await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(token))
        .send({})
        .expect(400);
    });

    it("refuses the wrong direction, another event's shuttle, and a trip not yet filled in", async () => {
      const returnShuttle = await make.shuttle(eventId, { direction: "RETURN" });
      await make.trip(eventId, paxId);
      await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(token))
        .send({ shuttleId: returnShuttle.id })
        .expect(400);

      const other = await make.event({ name: "Autre" });
      const foreign = await make.shuttle(other.id);
      await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(token))
        .send({ shuttleId: foreign.id })
        .expect(400);

      await t
        .http()
        .patch("/pax/me/trips/RETURN/shuttle")
        .set(t.asPax(token))
        .send({ shuttleId: returnShuttle.id })
        .expect(404);
    });
  });

  describe("GET /pax/me/trips (overview for other paxs)", () => {
    it("shows names and shuttle labels but no comments or contact details", async () => {
      const shuttle = await make.shuttle(eventId, { label: "Matin", stationArrivalTime: "08:25" });
      const other = await make.pax(eventId, { name: "Bilal", contactPhone: "0601" });
      await make.trip(eventId, other.id, {
        time: "07:50",
        shuttleId: shuttle.id,
        status: "ASSIGNED",
        comment: "secret",
        stationId,
      });

      const { body } = await t.http().get("/pax/me/trips").set(t.asPax(token)).expect(200);

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        paxName: "Bilal",
        shuttleId: shuttle.id,
        shuttleLabel: "Matin",
        stationId,
        stationName: "Gare de Testville",
        status: "ASSIGNED",
        waitLevel: "MEDIUM",
      });
      expect(body[0]).not.toHaveProperty("comment");
      expect(body[0]).not.toHaveProperty("pax");
      expect(JSON.stringify(body)).not.toContain("0601");
    });
  });

  describe("/admin/trips", () => {
    it("lists trips with the pax and the wait level, optionally filtered by status", async () => {
      const shuttle = await make.shuttle(eventId, { stationArrivalTime: "08:25" });
      await make.trip(eventId, paxId, { time: "07:20", shuttleId: shuttle.id, status: "ASSIGNED" });
      const other = await make.pax(eventId, { name: "Bilal" });
      await make.trip(eventId, other.id, { direction: "RETURN", status: "PENDING" });

      const all = await t.http().get("/admin/trips").set(t.asAdmin).query({ eventId }).expect(200);
      expect(all.body).toHaveLength(2);
      const assigned = all.body.find((trip: { status: string }) => trip.status === "ASSIGNED");
      expect(assigned).toMatchObject({
        waitLevel: "HIGH",
        pax: { id: paxId, name: "Alix Moreau" },
        station: null,
      });
      expect(assigned).not.toHaveProperty("shuttle");

      const outbound = await t
        .http()
        .get("/admin/trips")
        .set(t.asAdmin)
        .query({ eventId, direction: "OUTBOUND" })
        .expect(200);
      expect(outbound.body).toHaveLength(1);

      const pending = await t
        .http()
        .get("/admin/trips")
        .set(t.asAdmin)
        .query({ eventId, status: "PENDING" })
        .expect(200);
      expect(pending.body).toHaveLength(1);
      expect(pending.body[0]).toMatchObject({ status: "PENDING", waitLevel: null });

      await t
        .http()
        .get("/admin/trips")
        .set(t.asAdmin)
        .query({ eventId, status: "WEIRD" })
        .expect(400);
      await t.http().get("/admin/trips").query({ eventId }).expect(401);
    });

    it("assigns and unassigns a trip to a shuttle", async () => {
      const shuttle = await make.shuttle(eventId);
      const trip = await make.trip(eventId, paxId);

      const assigned = await t
        .http()
        .patch(`/admin/trips/${trip.id}/assign`)
        .set(t.asAdmin)
        .send({ shuttleId: shuttle.id })
        .expect(200);
      expect(assigned.body).toMatchObject({ shuttleId: shuttle.id, status: "ASSIGNED" });

      const unassigned = await t
        .http()
        .patch(`/admin/trips/${trip.id}/assign`)
        .set(t.asAdmin)
        .send({ shuttleId: null })
        .expect(200);
      expect(unassigned.body).toMatchObject({ shuttleId: null, status: "PENDING" });

      await t
        .http()
        .patch(`/admin/trips/${trip.id}/assign`)
        .set(t.asAdmin)
        .send({ shuttleId: "nope" })
        .expect(400);
      await t.http().patch(`/admin/trips/${trip.id}/assign`).set(t.asAdmin).send({}).expect(400);
      await t
        .http()
        .patch("/admin/trips/11111111-1111-4111-8111-111111111111/assign")
        .set(t.asAdmin)
        .send({ shuttleId: null })
        .expect(404);
    });

    it("sets a trip status (e.g. back to ASSIGNED after a re-check)", async () => {
      const trip = await make.trip(eventId, paxId, { status: "TO_RECHECK" });
      const { body } = await t
        .http()
        .patch(`/admin/trips/${trip.id}/status`)
        .set(t.asAdmin)
        .send({ status: "ASSIGNED" })
        .expect(200);
      expect(body.status).toBe("ASSIGNED");

      await t
        .http()
        .patch(`/admin/trips/${trip.id}/status`)
        .set(t.asAdmin)
        .send({ status: "DONE" })
        .expect(400);
    });
  });
});
