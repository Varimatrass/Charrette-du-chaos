import { factories } from "./support/factories.js";
import { createTestApp, TestApp } from "./support/test-app.js";

describe("Shuttles (e2e)", () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let eventId: string;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.prisma);
  });
  beforeEach(async () => {
    await t.resetDatabase();
    eventId = (await make.event()).id;
  });
  afterAll(() => t.close());

  const validShuttle = () => ({
    eventId,
    label: "Navette gare — matin",
    day: "2026-09-18",
    direction: "OUTBOUND",
    departureTime: "08:00",
    stationArrivalTime: "08:25",
    capacity: 4,
  });

  describe("/admin/shuttles", () => {
    it("is admin-only", async () => {
      await t.http().get("/admin/shuttles").query({ eventId }).expect(401);
      await t.http().post("/admin/shuttles").send(validShuttle()).expect(401);
    });

    it("creates a shuttle driven by a pax of the event", async () => {
      const driver = await make.pax(eventId, { name: "Sam" });
      const { body } = await t
        .http()
        .post("/admin/shuttles")
        .set(t.asAdmin)
        .send({ ...validShuttle(), driverPaxId: driver.id })
        .expect(201);
      expect(body).toMatchObject({
        label: "Navette gare — matin",
        direction: "OUTBOUND",
        driverPaxId: driver.id,
      });
      expect(body.day).toMatch(/^2026-09-18/);

      const other = await make.event({ name: "Autre" });
      const stranger = await make.pax(other.id, { name: "Inconnu" });
      await t
        .http()
        .post("/admin/shuttles")
        .set(t.asAdmin)
        .send({ ...validShuttle(), driverPaxId: stranger.id })
        .expect(400);
      await t
        .http()
        .post("/admin/shuttles")
        .set(t.asAdmin)
        .send({ ...validShuttle(), driverName: "Sam" })
        .expect(400);
    });

    it("validates the payload", async () => {
      await t
        .http()
        .post("/admin/shuttles")
        .set(t.asAdmin)
        .send({ ...validShuttle(), capacity: 0 })
        .expect(400);
      await t
        .http()
        .post("/admin/shuttles")
        .set(t.asAdmin)
        .send({ ...validShuttle(), direction: "UP" })
        .expect(400);
      await t
        .http()
        .post("/admin/shuttles")
        .set(t.asAdmin)
        .send({ ...validShuttle(), label: "" })
        .expect(400);
      await t
        .http()
        .post("/admin/shuttles")
        .set(t.asAdmin)
        .send({ ...validShuttle(), driverPaxId: "x" })
        .expect(400);
    });

    it("lists shuttles with remaining seats, ordered by day then departure time", async () => {
      const late = await make.shuttle(eventId, {
        label: "Tard",
        departureTime: "14:00",
        capacity: 4,
      });
      const early = await make.shuttle(eventId, {
        label: "Tôt",
        departureTime: "08:00",
        capacity: 2,
      });
      const pax = await make.pax(eventId);
      await make.trip(eventId, pax.id, { shuttleId: early.id, status: "ASSIGNED" });

      const driver = await make.pax(eventId, { name: "Sam" });
      await t.prisma.shuttle.update({ where: { id: late.id }, data: { driverPaxId: driver.id } });

      const { body } = await t
        .http()
        .get("/admin/shuttles")
        .set(t.asAdmin)
        .query({ eventId })
        .expect(200);
      expect(body.map((s: { id: string }) => s.id)).toEqual([early.id, late.id]);
      expect(body[0].remainingSeats).toBe(1);
      expect(body[0].driverPax).toBeNull();
      expect(body[1].remainingSeats).toBe(4);
      expect(body[1].driverPax).toEqual({ id: driver.id, name: "Sam" });
    });

    it("gets one shuttle with its passengers (contact details included) and wait levels", async () => {
      const shuttle = await make.shuttle(eventId, { stationArrivalTime: "08:25" });
      const pax = await make.pax(eventId, { contactPhone: "0600" });
      await make.trip(eventId, pax.id, {
        time: "07:50",
        shuttleId: shuttle.id,
        status: "ASSIGNED",
      });

      const { body } = await t
        .http()
        .get(`/admin/shuttles/${shuttle.id}`)
        .set(t.asAdmin)
        .expect(200);
      expect(body.remainingSeats).toBe(3);
      expect(body.passengers).toHaveLength(1);
      expect(body.passengers[0]).toMatchObject({
        waitLevel: "MEDIUM",
        pax: { id: pax.id, contactPhone: "0600" },
      });

      await t
        .http()
        .get("/admin/shuttles/11111111-1111-4111-8111-111111111111")
        .set(t.asAdmin)
        .expect(404);
    });

    it("updates provided fields, clears optional ones with null, and refuses to null a required one", async () => {
      const driver = await make.pax(eventId);
      const shuttle = await make.shuttle(eventId, { vehicle: "Kangoo", driverPaxId: driver.id });

      const { body } = await t
        .http()
        .patch(`/admin/shuttles/${shuttle.id}`)
        .set(t.asAdmin)
        .send({ label: "Renommée", vehicle: null, driverPaxId: null })
        .expect(200);
      expect(body).toMatchObject({
        label: "Renommée",
        vehicle: null,
        driverPaxId: null,
        capacity: 4,
      });

      await t
        .http()
        .patch(`/admin/shuttles/${shuttle.id}`)
        .set(t.asAdmin)
        .send({ label: null })
        .expect(400);
      await t
        .http()
        .patch(`/admin/shuttles/${shuttle.id}`)
        .set(t.asAdmin)
        .send({ capacity: 0 })
        .expect(400);
      await t
        .http()
        .patch(`/admin/shuttles/${shuttle.id}`)
        .set(t.asAdmin)
        .send({ eventId })
        .expect(400);
    });
  });

  describe("GET /pax/me/shuttles (planning for paxs)", () => {
    it("lists shuttles with passenger names only, and the driver's phone only for co-passengers", async () => {
      const driver = await make.pax(eventId, { name: "Sam", contactPhone: "0699" });
      const shuttle = await make.shuttle(eventId, { driverPaxId: driver.id });
      const emptyShuttle = await make.shuttle(eventId, {
        label: "Vide",
        direction: "RETURN",
        driverPaxId: driver.id,
      });
      const me = await make.pax(eventId, { name: "Moi" });
      const other = await make.pax(eventId, { name: "Bilal", contactEmail: "b@example.com" });
      await make.trip(eventId, me.id, { shuttleId: shuttle.id, status: "ASSIGNED" });
      await make.trip(eventId, other.id, { shuttleId: shuttle.id, status: "ASSIGNED" });
      const outsider = await make.pax(eventId, { name: "Dehors" });

      const mine = await t.http().get("/pax/me/shuttles").set(t.asPax(me.accessToken)).expect(200);
      const withMe = mine.body.find((s: { id: string }) => s.id === shuttle.id);
      expect(withMe).toMatchObject({
        remainingSeats: 2,
        driverContactPhone: "0699",
        driverPax: { id: driver.id, name: "Sam" },
      });
      expect(withMe.passengers).toEqual(
        expect.arrayContaining([
          { paxId: me.id, name: "Moi" },
          { paxId: other.id, name: "Bilal" },
        ]),
      );
      expect(JSON.stringify(mine.body)).not.toContain("b@example.com");
      const empty = mine.body.find((s: { id: string }) => s.id === emptyShuttle.id);
      expect(empty).toMatchObject({ passengers: [], driverContactPhone: null });

      const theirs = await t
        .http()
        .get("/pax/me/shuttles")
        .set(t.asPax(outsider.accessToken))
        .expect(200);
      const notWithThem = theirs.body.find((s: { id: string }) => s.id === shuttle.id);
      expect(notWithThem.driverContactPhone).toBeNull();
      expect(notWithThem.passengers).toHaveLength(2);
    });
  });
});
