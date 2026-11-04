import { factories } from "./support/factories.js";
import { TEST_FRONTEND_URL } from "./support/env.js";
import { createTestApp, TestApp } from "./support/test-app.js";

describe("Pax (e2e)", () => {
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

  describe("POST /pax (public registration)", () => {
    it("creates the pax and returns the token and personal link exactly once", async () => {
      const { body } = await t
        .http()
        .post("/pax")
        .send({ eventId, name: "Alix Moreau", contactEmail: "alix@example.com", hasVehicle: true })
        .expect(201);

      expect(body.pax).toEqual({ id: expect.any(String), name: "Alix Moreau" });
      expect(body.accessToken).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.personalLink).toBe(`${TEST_FRONTEND_URL}/mon-espace/${body.accessToken}`);

      const stored = await t.prisma.pax.findUniqueOrThrow({ where: { id: body.pax.id } });
      expect(stored).toMatchObject({ eventId, contactEmail: "alix@example.com", hasVehicle: true });
    });

    it("validates the payload", async () => {
      await t.http().post("/pax").send({ eventId, name: "" }).expect(400);
      await t.http().post("/pax").send({ eventId: "nope", name: "Alix" }).expect(400);
      await t
        .http()
        .post("/pax")
        .send({ eventId, name: "Alix", contactEmail: "not-an-email" })
        .expect(400);
      await t.http().post("/pax").send({ eventId, name: "Alix", hasVehicle: "oui" }).expect(400);
      await t.http().post("/pax").send({ eventId, name: "Alix", accessToken: "hack" }).expect(400);
    });
  });

  describe("/pax/me (self-service)", () => {
    it("requires a valid personal token", async () => {
      await t.http().get("/pax/me").expect(401);
      await t.http().get("/pax/me").set(t.asPax("unknown-token")).expect(401);
    });

    it("returns the pax with trips and assigned shuttles, never the token", async () => {
      const pax = await make.pax(eventId);
      const shuttle = await make.shuttle(eventId);
      await make.trip(eventId, pax.id, { shuttleId: shuttle.id, status: "ASSIGNED" });

      const { body } = await t.http().get("/pax/me").set(t.asPax(pax.accessToken)).expect(200);

      expect(body).not.toHaveProperty("accessToken");
      expect(body).toMatchObject({ id: pax.id, name: pax.name });
      expect(body.trips).toHaveLength(1);
      expect(body.trips[0]).toMatchObject({
        direction: "OUTBOUND",
        status: "ASSIGNED",
        shuttle: { id: shuttle.id, label: shuttle.label },
        station: null,
        car: null,
      });
      expect(body.car).toBeNull();
    });

    it("updates provided fields and clears the ones sent as null", async () => {
      const pax = await make.pax(eventId, {
        contactEmail: "old@example.com",
        contactPhone: "0600",
      });

      const { body } = await t
        .http()
        .patch("/pax/me")
        .set(t.asPax(pax.accessToken))
        .send({ name: "Alix M.", contactEmail: null, discordHandle: "alix#1234" })
        .expect(200);

      expect(body).toMatchObject({
        name: "Alix M.",
        contactEmail: null,
        contactPhone: "0600",
        discordHandle: "alix#1234",
      });
      expect(body).not.toHaveProperty("accessToken");
    });

    it("refuses to erase the name or to change the event", async () => {
      const pax = await make.pax(eventId);
      await t
        .http()
        .patch("/pax/me")
        .set(t.asPax(pax.accessToken))
        .send({ name: null })
        .expect(400);
      await t.http().patch("/pax/me").set(t.asPax(pax.accessToken)).send({ name: "" }).expect(400);
      await t
        .http()
        .patch("/pax/me")
        .set(t.asPax(pax.accessToken))
        .send({ eventId: "11111111-1111-4111-8111-111111111111" })
        .expect(400);
    });

    it("GET /pax/me/paxs lists the other paxs with their Discord and a trip summary, no email/phone (Q1)", async () => {
      const me = await make.pax(eventId, { name: "Moi" });
      const bilal = await make.pax(eventId, {
        name: "Bilal",
        contactEmail: "b@example.com",
        contactPhone: "0601",
        discordHandle: "bilal#1",
        comment: "secret",
      });
      await make.trip(eventId, bilal.id, {
        mode: "CARPOOL",
        carpoolRole: "PASSENGER",
        lookingForCarpool: true,
        comment: "interne",
      });
      const otherEvent = await make.event({ name: "Autre" });
      await make.pax(otherEvent.id, { name: "Pas mon évènement" });

      const { body } = await t.http().get("/pax/me/paxs").set(t.asPax(me.accessToken)).expect(200);

      expect(body.map((p: { name: string }) => p.name)).toEqual(["Bilal", "Moi"]);
      const bilalOverview = body.find((p: { name: string }) => p.name === "Bilal");
      expect(bilalOverview).toEqual({
        id: bilal.id,
        name: "Bilal",
        discordHandle: "bilal#1",
        trips: [
          {
            direction: "OUTBOUND",
            mode: "CARPOOL",
            stationId: null,
            status: "PENDING",
            shuttleId: null,
            carpoolRole: "PASSENGER",
            carId: null,
            lookingForCarpool: true,
          },
        ],
      });
      expect(JSON.stringify(body)).not.toMatch(/b@example.com|0601|secret|interne/);
    });
  });

  describe("/admin/pax (back-office)", () => {
    it("requires the admin key and a valid eventId", async () => {
      await t.http().get("/admin/pax").query({ eventId }).expect(401);
      await t.http().get("/admin/pax").set(t.asAdmin).expect(400);
      await t.http().get("/admin/pax").set(t.asAdmin).query({ eventId: "nope" }).expect(400);
    });

    it("lists the event's paxs with their token (to resend a lost link)", async () => {
      const pax = await make.pax(eventId);
      const { body } = await t
        .http()
        .get("/admin/pax")
        .set(t.asAdmin)
        .query({ eventId })
        .expect(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ id: pax.id, accessToken: pax.accessToken });
    });

    it("searches by name fragment, case-insensitively", async () => {
      await make.pax(eventId, { name: "Alix Moreau" });
      await make.pax(eventId, { name: "Bilal Nasser" });

      const { body } = await t
        .http()
        .get("/admin/pax/search")
        .set(t.asAdmin)
        .query({ eventId, name: "MOREAU" })
        .expect(200);
      expect(body.map((p: { name: string }) => p.name)).toEqual(["Alix Moreau"]);

      await t.http().get("/admin/pax/search").set(t.asAdmin).query({ eventId }).expect(400);
    });

    it("gets one pax by id", async () => {
      const pax = await make.pax(eventId);
      await t.http().get(`/admin/pax/${pax.id}`).set(t.asAdmin).expect(200);
      await t
        .http()
        .get("/admin/pax/11111111-1111-4111-8111-111111111111")
        .set(t.asAdmin)
        .expect(404);
    });
  });

  describe("DELETE /admin/pax/:id (B8)", () => {
    it("lets the admin delete a pax (e.g. a duplicate) with their trips; their shuttle loses its driver, their car stays ownerless", async () => {
      const event = await make.event({ name: "Suppression" });
      const pax = await make.pax(event.id, { name: "Doublon" });
      await make.trip(event.id, pax.id);
      const shuttle = await make.shuttle(event.id, { driverPaxId: pax.id });
      const car = await make.car(event.id, pax.id);
      const passenger = await make.pax(event.id, { name: "Bilal" });
      const ride = await make.trip(event.id, passenger.id, {
        mode: "CARPOOL",
        carpoolRole: "PASSENGER",
        carId: car.id,
        status: "NO_SHUTTLE",
      });

      await t.http().delete(`/admin/pax/${pax.id}`).set(t.asPax(pax.accessToken)).expect(401);
      await t.http().delete(`/admin/pax/${pax.id}`).set(t.asAdmin).expect(204);

      expect(await t.prisma.pax.findUnique({ where: { id: pax.id } })).toBeNull();
      expect(await t.prisma.trip.count({ where: { paxId: pax.id } })).toBe(0);
      expect(
        (await t.prisma.shuttle.findUniqueOrThrow({ where: { id: shuttle.id } })).driverPaxId,
      ).toBeNull();
      // La voiture reste, sans propriétaire : ses passager·es gardent leur place.
      expect(await t.prisma.car.findUniqueOrThrow({ where: { id: car.id } })).toMatchObject({
        ownerPaxId: null,
      });
      expect(await t.prisma.trip.findUniqueOrThrow({ where: { id: ride.id } })).toMatchObject({
        carId: car.id,
        lookingForCarpool: false,
      });
      await t.http().delete(`/admin/pax/${pax.id}`).set(t.asAdmin).expect(404);
    });
  });
});
