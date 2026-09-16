import { factories } from "./support/factories";
import { createTestApp, TestApp } from "./support/test-app";

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
    referenceStation: "Gare de Testville",
  };

  describe("public read", () => {
    it("lists events, most recent first", async () => {
      await make.event({ name: "Ancien", startDate: new Date("2025-06-01") });
      await make.event({ name: "Récent", startDate: new Date("2026-09-18") });

      const { body } = await t.http().get("/events").expect(200);
      expect(body.map((e: { name: string }) => e.name)).toEqual(["Récent", "Ancien"]);
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

    it("updates only the provided fields", async () => {
      const event = await make.event();
      const { body } = await t
        .http()
        .patch(`/admin/events/${event.id}`)
        .set(t.asAdmin)
        .send({ location: "Nouveau lieu" })
        .expect(200);
      expect(body).toMatchObject({ name: event.name, location: "Nouveau lieu" });
    });
  });
});
