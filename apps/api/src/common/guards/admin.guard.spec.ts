import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ADMIN_KEY_HEADER } from "../constants";
import { AdminGuard } from "./admin.guard";

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  const request = { header: (name: string) => headers[name.toLowerCase()] };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardWithKey(configuredKey: string | undefined): AdminGuard {
  const config = { get: jest.fn().mockReturnValue(configuredKey) } as unknown as ConfigService;
  return new AdminGuard(config);
}

describe("AdminGuard", () => {
  it("lets a request through when the header matches ADMIN_KEY", () => {
    const guard = guardWithKey("s3cret");
    expect(guard.canActivate(contextWithHeaders({ [ADMIN_KEY_HEADER]: "s3cret" }))).toBe(true);
  });

  it("rejects a missing header", () => {
    const guard = guardWithKey("s3cret");
    expect(() => guard.canActivate(contextWithHeaders({}))).toThrow(UnauthorizedException);
  });

  it("rejects a wrong key", () => {
    const guard = guardWithKey("s3cret");
    expect(() => guard.canActivate(contextWithHeaders({ [ADMIN_KEY_HEADER]: "nope" }))).toThrow(
      UnauthorizedException,
    );
  });

  it("refuses everything when ADMIN_KEY is not configured server-side", () => {
    const guard = guardWithKey(undefined);
    expect(() => guard.canActivate(contextWithHeaders({ [ADMIN_KEY_HEADER]: "" }))).toThrow(
      /ADMIN_KEY/,
    );
  });
});
