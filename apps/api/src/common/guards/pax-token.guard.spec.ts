import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { makePax } from "../../testing/fixtures";
import { asPrismaService, createPrismaMock } from "../../testing/prisma-mock";
import { PAX_TOKEN_HEADER } from "../constants";
import { PaxTokenGuard, RequestWithPax } from "./pax-token.guard";

function contextWithToken(token?: string): { context: ExecutionContext; request: RequestWithPax } {
  const request = {
    header: (name: string) => (name === PAX_TOKEN_HEADER ? token : undefined),
  } as unknown as RequestWithPax;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("PaxTokenGuard", () => {
  const prisma = createPrismaMock();
  const guard = new PaxTokenGuard(asPrismaService(prisma));

  beforeEach(() => jest.clearAllMocks());

  it("attaches the pax to the request when the token is known", async () => {
    const pax = makePax();
    prisma.pax.findUnique.mockResolvedValue(pax);
    const { context, request } = contextWithToken(pax.accessToken);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.pax).toBe(pax);
    expect(prisma.pax.findUnique).toHaveBeenCalledWith({ where: { accessToken: pax.accessToken } });
  });

  it("rejects a request without token without hitting the database", async () => {
    const { context } = contextWithToken(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(prisma.pax.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    prisma.pax.findUnique.mockResolvedValue(null);
    const { context } = contextWithToken("unknown");
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
