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
      expect(body).toMatchObject({ direction: "RETURN", mode: null, status: "NO_SHUTTLE" });
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

    it("keeps trip days coherent with the event and with each other (B9)", async () => {
      const put = (direction: string, body: object) =>
        t.http().put(`/pax/me/trips/${direction}`).set(t.asPax(token)).send(body);

      await put("OUTBOUND", { mode: "TRAIN", time: "8h" }).expect(400);
      const late = await put("OUTBOUND", { mode: "TRAIN", day: "2026-09-21" }).expect(400);
      expect(late.body.message).toMatch(/se termine le dimanche 20 septembre/);
      await put("RETURN", { mode: "TRAIN", day: "2026-09-17" }).expect(400);

      // Arriver en avance ou repartir plus tard, c'est possible.
      await put("OUTBOUND", { mode: "TRAIN", day: "2026-09-17" }).expect(200);
      await put("RETURN", { mode: "TRAIN", day: "2026-09-22" }).expect(200);

      await put("OUTBOUND", { mode: "TRAIN", day: "2026-09-19" }).expect(200);
      const before = await put("RETURN", { mode: "TRAIN", day: "2026-09-18" }).expect(400);
      expect(before.body.message).toMatch(/avant ton arrivée/);
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

    it("a driver cannot reduce their seats below the passengers already in (B6)", async () => {
      const driver = await make.pax(eventId, { name: "Fanta" });
      const car = await make.car(eventId, driver.id, { seats: 2 });
      await make.trip(eventId, paxId, {
        mode: "CARPOOL",
        carpoolRole: "PASSENGER",
        carId: car.id,
        status: "NO_SHUTTLE",
      });
      const { body } = await t
        .http()
        .put("/pax/me/car")
        .set(t.asPax(driver.accessToken))
        .send({ name: "Twingo verte", seats: 0, lendingMode: "NOT_AVAILABLE" })
        .expect(400);
      expect(body.message).toMatch(/Alix Moreau/);
      await t
        .http()
        .put("/pax/me/car")
        .set(t.asPax(driver.accessToken))
        .send({ name: "Twingo verte", seats: 1, lendingMode: "NOT_AVAILABLE" })
        .expect(200);
    });

    it("a passenger can name a car not in the list yet: it is created ownerless, then claimed by its driver (Q6)", async () => {
      const put = (pax: string, body: object) =>
        t.http().put("/pax/me/trips/OUTBOUND").set(t.asPax(pax)).send(body);
      const first = await put(token, {
        mode: "CARPOOL",
        carpoolRole: "PASSENGER",
        newCarName: "Le van de Lou",
        newCarSeats: 2,
      }).expect(200);
      const car = await t.prisma.car.findUniqueOrThrow({ where: { id: first.body.carId } });
      expect(car).toMatchObject({ ownerPaxId: null, name: "Le van de Lou", seats: 2 });

      // Un·e autre passager·e qui tape le même nom monte dans la même voiture.
      const other = await make.pax(eventId, { name: "Camille" });
      const second = await put(other.accessToken, {
        mode: "CARPOOL",
        carpoolRole: "PASSENGER",
        newCarName: "le van de lou",
      }).expect(200);
      expect(second.body.carId).toBe(car.id);

      const cars = await t.http().get("/pax/me/cars").set(t.asPax(token)).expect(200);
      expect(cars.body[0]).toMatchObject({ name: "Le van de Lou", owner: null });

      // Lou s'inscrit et revendique sa voiture.
      const lou = await make.pax(eventId, { name: "Lou" });
      await t.http().post(`/pax/me/cars/${car.id}/claim`).set(t.asPax(lou.accessToken)).expect(201);
      expect(await t.prisma.car.findUniqueOrThrow({ where: { id: car.id } })).toMatchObject({
        ownerPaxId: lou.id,
      });
      expect((await t.prisma.pax.findUniqueOrThrow({ where: { id: lou.id } })).hasVehicle).toBe(
        true,
      );
      // Déjà revendiquée : refusé pour les autres.
      await t
        .http()
        .post(`/pax/me/cars/${car.id}/claim`)
        .set(t.asPax(other.accessToken))
        .expect(400);
    });

    it("a passenger who claims the car they ride in becomes its driver", async () => {
      const car = await make.car(eventId, null, { name: "Kangoo" });
      await make.trip(eventId, paxId, {
        mode: "CARPOOL",
        carpoolRole: "PASSENGER",
        carId: car.id,
        status: "NO_SHUTTLE",
      });
      await t.http().post(`/pax/me/cars/${car.id}/claim`).set(t.asPax(token)).expect(201);
      expect(
        await t.prisma.trip.findUniqueOrThrow({
          where: { paxId_direction: { paxId, direction: "OUTBOUND" } },
        }),
      ).toMatchObject({ carpoolRole: "DRIVER", carId: car.id });

      // Une seule voiture par pax.
      const another = await make.car(eventId, null, { name: "Autre" });
      await t.http().post(`/pax/me/cars/${another.id}/claim`).set(t.asPax(token)).expect(400);
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

  describe("shuttles are for trips by train only", () => {
    it("leaving the train frees the shuttle seat and marks the trip NO_SHUTTLE (B2)", async () => {
      const shuttle = await make.shuttle(eventId);
      await make.trip(eventId, paxId, { shuttleId: shuttle.id, status: "ASSIGNED" });

      const { body } = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "CARPOOL", origin: "Lyon", carpoolRole: "PASSENGER" })
        .expect(200);
      expect(body).toMatchObject({ shuttleId: null, status: "NO_SHUTTLE" });

      const train = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "TRAIN" })
        .expect(200);
      expect(train.body).toMatchObject({ shuttleId: null, status: "PENDING" });
    });

    it("a pax not coming by train cannot take a shuttle, neither can the admin place them (B3)", async () => {
      const shuttle = await make.shuttle(eventId);
      const trip = await make.trip(eventId, paxId, { mode: "OTHER", status: "NO_SHUTTLE" });

      const self = await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(token))
        .send({ shuttleId: shuttle.id })
        .expect(400);
      expect(self.body.message).toMatch(/train/);

      await t
        .http()
        .patch(`/admin/trips/${trip.id}/assign`)
        .set(t.asAdmin)
        .send({ shuttleId: shuttle.id })
        .expect(400);
    });

    it("a pax cannot take a shuttle running another day than their trip (B7)", async () => {
      const shuttle = await make.shuttle(eventId, { day: new Date("2026-07-10") });
      await make.trip(eventId, paxId, { day: new Date("2026-07-11") });

      const { body } = await t
        .http()
        .patch("/pax/me/trips/OUTBOUND/shuttle")
        .set(t.asPax(token))
        .send({ shuttleId: shuttle.id })
        .expect(400);
      expect(body.message).toMatch(/vendredi 10 juillet.*samedi 11 juillet/);
    });
  });

  describe("history of changes to recheck (P2)", () => {
    it("records what the pax changed on a placed trip, shows it to the admin until it is acknowledged", async () => {
      const shuttle = await make.shuttle(eventId, { label: "Navette 1" });
      const trip = await make.trip(eventId, paxId, {
        day: new Date("2026-09-18"),
        stationId,
        shuttleId: shuttle.id,
        status: "ASSIGNED",
      });
      const put = (body: object) =>
        t.http().put("/pax/me/trips/OUTBOUND").set(t.asPax(token)).send(body);

      // Rien de neuf : pas de "à revérifier", pas d'historique.
      const same = await put({ mode: "TRAIN", day: "2026-09-18", time: "08:05", stationId });
      expect(same.body.status).toBe("ASSIGNED");

      await put({ mode: "TRAIN", day: "2026-09-18", time: "09:40", stationId }).expect(200);
      const list = await t.http().get(`/admin/trips?eventId=${eventId}`).set(t.asAdmin);
      const row = list.body.find((r: { id: string }) => r.id === trip.id);
      expect(row.status).toBe("TO_RECHECK");
      expect(row.pendingChanges).toHaveLength(1);
      expect(row.pendingChanges[0].changes).toEqual([
        { field: "time", before: "08:05", after: "09:40" },
      ]);

      // "Marquer vérifié" acquitte l'historique.
      await t
        .http()
        .patch(`/admin/trips/${trip.id}/status`)
        .set(t.asAdmin)
        .send({ status: "ASSIGNED" })
        .expect(200);
      const after = await t.http().get(`/admin/trips?eventId=${eventId}`).set(t.asAdmin);
      expect(after.body.find((r: { id: string }) => r.id === trip.id).pendingChanges).toEqual([]);

      // Quitter le train : l'orga voit que le pax est sorti de la navette.
      await put({ mode: "OTHER" }).expect(200);
      const left = await t.http().get(`/admin/trips?eventId=${eventId}`).set(t.asAdmin);
      const leftRow = left.body.find((r: { id: string }) => r.id === trip.id);
      expect(leftRow.status).toBe("NO_SHUTTLE");
      expect(leftRow.pendingChanges[0].changes).toEqual(
        expect.arrayContaining([
          { field: "mode", before: "TRAIN", after: "OTHER" },
          { field: "shuttle", before: "Navette 1", after: null },
        ]),
      );
      await t.http().post(`/admin/trips/${trip.id}/acknowledge-changes`).set(t.asAdmin).expect(204);
      expect(await t.prisma.tripChange.count({ where: { acknowledgedAt: null } })).toBe(0);
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
