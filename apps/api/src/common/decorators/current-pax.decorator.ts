import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Pax } from "@prisma/client";
import type { RequestWithPax } from "../guards/pax-token.guard.js";

/** À utiliser sur une route protégée par PaxTokenGuard. */
export const CurrentPax = createParamDecorator((_data: unknown, ctx: ExecutionContext): Pax => {
  const request = ctx.switchToHttp().getRequest<RequestWithPax>();
  return request.pax;
});
