import { factories } from "./support/factories.js";
import { createTestApp, TestApp } from "./support/test-app.js";

describe("Stations (e2e)", () => {
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

  it("lists an event's stations publicly, sorted by name", async () => {
    await make.station(eventId, { name: "Zed" });
    await make.station(eventId, { name: "Alpha" });
    const { body } = await t.http().get(`/events/${eventId}/stations`).expect(200);
    expect(body.map((s: { name: string }) => s.name)).toEqual(["Alpha", "Zed"]);
    await t.http().get("/events/11111111-1111-4111-8111-111111111111/stations").expect(404);
  });

  it("lets admins add and remove stations (removal unlinks trips and the preferred station)", async () => {
    const { body: created } = await t
      .http()
      .post(`/admin/events/${eventId}/stations`)
      .set(t.asAdmin)
      .send({ name: " Gare  Centrale " })
      .expect(201);
    expect(created.name).toBe("Gare Centrale");
    // Même nom = même gare, pas de doublon.
    const { body: again } = await t
      .http()
      .post(`/admin/events/${eventId}/stations`)
      .set(t.asAdmin)
      .send({ name: "Gare Centrale" })
      .expect(201);
    expect(again.id).toBe(created.id);
    await t
      .http()
      .post(`/admin/events/${eventId}/stations`)
      .set(t.asAdmin)
      .send({ name: "" })
      .expect(400);
    await t.http().post(`/admin/events/${eventId}/stations`).send({ name: "x" }).expect(401);

    await t.prisma.event.update({
      where: { id: eventId },
      data: { preferredStationId: created.id },
    });
    const pax = await make.pax(eventId);
    await make.trip(eventId, pax.id, { stationId: created.id });

    await t
      .http()
      .delete(`/admin/events/${eventId}/stations/${created.id}`)
      .set(t.asAdmin)
      .expect(204);
    await t
      .http()
      .delete(`/admin/events/${eventId}/stations/${created.id}`)
      .set(t.asAdmin)
      .expect(404);

    const event = await t.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.preferredStationId).toBeNull();
    const trip = await t.prisma.trip.findFirstOrThrow({ where: { paxId: pax.id } });
    expect(trip.stationId).toBeNull();
  });

  it("lets a pax add a station to their own event", async () => {
    const pax = await make.pax(eventId);
    const { body } = await t
      .http()
      .post("/pax/me/stations")
      .set(t.asPax(pax.accessToken))
      .send({ name: "Ma gare" })
      .expect(201);
    expect(body).toMatchObject({ eventId, name: "Ma gare" });
    await t.http().post("/pax/me/stations").send({ name: "Ma gare" }).expect(401);
  });
});
