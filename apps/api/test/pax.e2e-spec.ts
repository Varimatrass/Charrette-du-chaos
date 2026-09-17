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
      await t
        .http()
        .post("/pax")
        .send({ eventId, name: "Alix", vehicleLendingMode: "MAYBE" })
        .expect(400);
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
      });
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

    it("GET /pax/me/paxs lists the other paxs without any contact details", async () => {
      const me = await make.pax(eventId, { name: "Moi" });
      await make.pax(eventId, {
        name: "Bilal",
        contactEmail: "b@example.com",
        contactPhone: "0601",
        discordHandle: "bilal",
      });
      const otherEvent = await make.event({ name: "Autre" });
      await make.pax(otherEvent.id, { name: "Pas mon évènement" });

      const { body } = await t.http().get("/pax/me/paxs").set(t.asPax(me.accessToken)).expect(200);

      expect(body.map((p: { name: string }) => p.name)).toEqual(["Bilal", "Moi"]);
      const bilal = body.find((p: { name: string }) => p.name === "Bilal");
      expect(bilal).toEqual({
        id: expect.any(String),
        name: "Bilal",
        discordHandle: "bilal",
        comment: null,
        hasVehicle: null,
        vehicleLendingMode: null,
        hasDrivingLicense: null,
        willingToDriveShuttle: null,
      });
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
});
