import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { SKIP_CSRF } from "@/common/decorators/skip-csrf.decorator";
import { CSRF_COOKIE } from "@/common/guards/jwt-auth.guard";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit CSRF. The session lives in an httpOnly cookie, so a
 * state-changing request must also echo the readable `ic_csrf` cookie in the
 * `x-csrf-token` header — something a cross-site form cannot do.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const cookies = request.cookies as Record<string, string> | undefined;
    const cookie = cookies?.[CSRF_COOKIE];
    const header = request.headers["x-csrf-token"];

    if (!cookie || typeof header !== "string" || !matches(cookie, header)) {
      throw new ForbiddenException("Missing or invalid CSRF token");
    }
    return true;
  }
}

function matches(cookie: string, header: string): boolean {
  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
