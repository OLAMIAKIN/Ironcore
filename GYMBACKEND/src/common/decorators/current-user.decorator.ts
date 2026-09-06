import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "@/common/types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) throw new UnauthorizedException("Not signed in");
    return request.user;
  },
);
