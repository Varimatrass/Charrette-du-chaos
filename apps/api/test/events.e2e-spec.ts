import { factories } from "./support/factories.js";
import { createTestApp, TestApp } from "./support/test-app.js";

describe("Events (e2e)", () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.prisma);
  });
  beforeEach(() => t.resetDatabase());
  afterAll(() => t.close());

  const validEvent = {
    name: "Été 2026",
    startDate: "2026-09-18",
    endDate: "2026-09-20",
    location: "Ferme du Chaos",
    stations: ["Gare de Testville", "Gare du Nord"],
  };

  describe("public read", () => {
    it("lists open events only, most recent first, with their stations", async () => {
      await make.event({ name: "Ancien", startDate: new Date("2025-06-01") });
      const recent = await make.event({ name: "Récent", startDate: new Date("2026-09-18") });
      await make.station(recent.id, { name: "Gare Z" });
      await make.event({ name: "Brouillon", openToPaxs: false });

      const { body } = await t.http().get("/events").expect(200);
      expect(body.map((e: { name: string }) => e.name)).toEqual(["Récent", "Ancien"]);
      expect(body[0].stations.map((s: { name: string }) => s.name)).toEqual(["Gare Z"]);
    });

    it("still serves a draft event by id (direct link) but lists it only for admins", async () => {
      const draft = await make.event({ name: "Brouillon", openToPaxs: false });
      await t.http().get(`/events/${draft.id}`).expect(200);
      await t.http().get("/admin/events").expect(401);
      const { body } = await t.http().get("/admin/events").set(t.asAdmin).expect(200);
      expect(body.map((e: { name: string }) => e.name)).toEqual(["Brouillon"]);
    });

    it("gets one event by id, 404 for an unknown one, 400 for a malformed id", async () => {
      const event = await make.event();
      const { body } = await t.http().get(`/events/${event.id}`).expect(200);
      expect(body).toMatchObject({ id: event.id, name: event.name, location: event.location });

      await t.http().get("/events/11111111-1111-4111-8111-111111111111").expect(404);
      await t.http().get("/events/not-a-uuid").expect(400);
    });
  });

  describe("admin write", () => {
    it("requires the admin key", async () => {
      await t.http().post("/admin/events").send(validEvent).expect(401);
      await t.http().post("/admin/events").set("x-admin-key", "nope").send(validEvent).expect(401);
    });

    it("creates an event", async () => {
      const { body } = await t
        .http()
        .post("/admin/events")
        .set(t.asAdmin)
        .send(validEvent)
        .expect(201);
      expect(body).toMatchObject({ name: "Été 2026", location: "Ferme du Chaos" });
      expect(body.startDate).toMatch(/^2026-09-18/);
      expect(await t.prisma.event.count()).toBe(1);
    });

    it("rejects an invalid or unknown-field payload", async () => {
      await t.http().post("/admin/events").set(t.asAdmin).send({ name: "" }).expect(400);
      await t
        .http()
        .post("/admin/events")
        .set(t.asAdmin)
        .send({ ...validEvent, startDate: "not-a-date" })
        .expect(400);
      await t
        .http()
        .post("/admin/events")
        .set(t.asAdmin)
        .send({ ...validEvent, unexpected: "field" })
        .expect(400);
    });

    it("updates only the provided fields, including opening the event and the preferred station", async () => {
      const event = await make.event({ openToPaxs: false });
      const station = await make.station(event.id);
      const { body } = await t
        .http()
        .patch(`/admin/events/${event.id}`)
        .set(t.asAdmin)
        .send({ location: "Nouveau lieu", openToPaxs: true, preferredStationId: station.id })
        .expect(200);
      expect(body).toMatchObject({
        name: event.name,
        location: "Nouveau lieu",
        openToPaxs: true,
        preferredStationId: station.id,
      });

      const other = await make.event({ name: "Autre" });
      const foreign = await make.station(other.id, { name: "Ailleurs" });
      await t
        .http()
        .patch(`/admin/events/${event.id}`)
        .set(t.asAdmin)
        .send({ preferredStationId: foreign.id })
        .expect(400);
      await t
        .http()
        .patch(`/admin/events/${event.id}`)
        .set(t.asAdmin)
        .send({ name: null })
        .expect(400);
    });
  });
});
