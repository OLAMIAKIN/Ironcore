import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES } from "@/common/decorators/roles.decorator";
import type { Role } from "@/common/types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed?.length) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const role = request.user?.role;

    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException("Your role cannot do that");
    }
    return true;
  }
}
