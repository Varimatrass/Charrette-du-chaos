import { factories } from "./support/factories.js";
import { createTestApp, TestApp } from "./support/test-app.js";

describe("Trips (e2e)", () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let eventId: string;
  let token: string;
  let paxId: string;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.prisma);
  });
  beforeEach(async () => {
    await t.resetDatabase();
    eventId = (await make.event()).id;
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
        .send({ mode: "TRAIN", day: "2026-09-18", time: "08:05", station: "Gare" })
        .expect(200);
      expect(first.body).toMatchObject({
        direction: "OUTBOUND",
        status: "PENDING",
        time: "08:05",
        paxId,
        eventId,
      });

      const second = await t
        .http()
        .put("/pax/me/trips/OUTBOUND")
        .set(t.asPax(token))
        .send({ mode: "TRAIN", time: "09:05" })
        .expect(200);
      expect(second.body.id).toBe(first.body.id);
      // Les champs non renvoyés repassent explicitement à null ("pas encore décidé").
      expect(second.body).toMatchObject({ time: "09:05", day: null, station: null });
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
      });

      const { body } = await t.http().get("/pax/me/trips").set(t.asPax(token)).expect(200);

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        paxName: "Bilal",
        shuttleId: shuttle.id,
        shuttleLabel: "Matin",
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
      });
      expect(assigned).not.toHaveProperty("shuttle");

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
