import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestWithPax } from "../guards/pax-token.guard";

/** À utiliser sur une route protégée par PaxTokenGuard. */
export const CurrentPax = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithPax>();
  return request.pax;
});
