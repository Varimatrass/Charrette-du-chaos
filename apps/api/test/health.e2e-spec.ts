import { createTestApp, TestApp } from "./support/test-app";

describe("Health & admin auth (e2e)", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it("GET /health answers ok without any auth", async () => {
    await t.http().get("/health").expect(200).expect({ status: "ok" });
  });

  it("GET /admin/auth validates the admin key", async () => {
    await t.http().get("/admin/auth").expect(401);
    await t.http().get("/admin/auth").set("x-admin-key", "wrong").expect(401);
    await t.http().get("/admin/auth").set(t.asAdmin).expect(200).expect({ ok: true });
  });
});
