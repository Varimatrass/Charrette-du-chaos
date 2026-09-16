import { factories } from "./support/factories.js";
import { createTestApp, TestApp } from "./support/test-app.js";

describe("Driver availability slots (e2e)", () => {
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
    const pax = await make.pax(eventId, { willingToDriveShuttle: true });
    token = pax.accessToken;
    paxId = pax.id;
  });
  afterAll(() => t.close());

  it("lets a pax declare, list and delete their own slots", async () => {
    const created = await t
      .http()
      .post("/pax/me/availability-slots")
      .set(t.asPax(token))
      .send({ day: "2026-09-18", startTime: "09:00" })
      .expect(201);
    expect(created.body).toMatchObject({ paxId, eventId, startTime: "09:00", endTime: null });

    const list = await t.http().get("/pax/me/availability-slots").set(t.asPax(token)).expect(200);
    expect(list.body.map((s: { id: string }) => s.id)).toEqual([created.body.id]);

    await t
      .http()
      .delete(`/pax/me/availability-slots/${created.body.id}`)
      .set(t.asPax(token))
      .expect(204);
    expect(await t.prisma.driverAvailabilitySlot.count()).toBe(0);
  });

  it("validates the payload and requires a token", async () => {
    await t.http().post("/pax/me/availability-slots").set(t.asPax(token)).send({}).expect(400);
    await t.http().post("/pax/me/availability-slots").send({ day: "2026-09-18" }).expect(401);
  });

  it("never lets a pax delete someone else's slot", async () => {
    const other = await make.pax(eventId, { name: "Bilal" });
    const slot = await t.prisma.driverAvailabilitySlot.create({
      data: { eventId, paxId: other.id, day: new Date("2026-09-18") },
    });

    await t.http().delete(`/pax/me/availability-slots/${slot.id}`).set(t.asPax(token)).expect(403);
    await t
      .http()
      .delete("/pax/me/availability-slots/11111111-1111-4111-8111-111111111111")
      .set(t.asPax(token))
      .expect(404);
    expect(await t.prisma.driverAvailabilitySlot.count()).toBe(1);
  });

  it("gives the back-office every slot of the event with the pax name and phone", async () => {
    await t.prisma.pax.update({ where: { id: paxId }, data: { contactPhone: "0600" } });
    await t.prisma.driverAvailabilitySlot.create({
      data: { eventId, paxId, day: new Date("2026-09-18") },
    });

    const { body } = await t
      .http()
      .get("/admin/availability-slots")
      .set(t.asAdmin)
      .query({ eventId })
      .expect(200);
    expect(body).toHaveLength(1);
    expect(body[0].pax).toEqual({ id: paxId, name: "Alix Moreau", contactPhone: "0600" });

    await t.http().get("/admin/availability-slots").query({ eventId }).expect(401);
  });
});
