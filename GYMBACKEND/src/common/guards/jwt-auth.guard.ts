import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC } from "@/common/decorators/public.decorator";
import type { AuthUser, Role } from "@/common/types";

export const ACCESS_COOKIE = "ic_at";
export const REFRESH_COOKIE = "ic_rt";
export const CSRF_COOKIE = "ic_csrf";

type AccessClaims = {
  sub: string;
  role: Role;
  gymId?: string;
  ver: number;
};

/**
 * Global guard. The access token normally arrives in an httpOnly cookie; a
 * bearer header is accepted too so non-browser clients (and curl) work.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const token = readToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException("Sign in to continue");
    }

    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });

      const user: AuthUser = {
        id: claims.sub,
        role: claims.role,
        gymId: claims.gymId,
        tokenVersion: claims.ver,
      };
      request.user = user;
      return true;
    } catch {
      // A public route with a stale cookie still renders, just anonymously.
      if (isPublic) return true;
      throw new UnauthorizedException("Your session has expired");
    }
  }
}

function readToken(request: Request): string | null {
  const cookies = request.cookies as Record<string, string> | undefined;
  const fromCookie = cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;

  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);

  return null;
}
