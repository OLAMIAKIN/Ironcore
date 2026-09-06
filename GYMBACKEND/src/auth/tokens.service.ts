import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Response } from "express";
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from "@/common/guards/jwt-auth.guard";
import type { Role } from "@/common/types";
import {
  RefreshToken,
  type RefreshTokenDocument,
} from "@/auth/schemas/refresh-token.schema";

export type TokenSubject = {
  id: Types.ObjectId;
  role: Role;
  gymId?: Types.ObjectId;
  tokenVersion: number;
};

export type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

const MINUTE = 60 * 1000;

/** Issues, rotates and revokes sessions, and owns the cookie shapes. */
@Injectable()
export class TokensService {
  constructor(
    @InjectModel(RefreshToken.name)
    private readonly refreshTokens: Model<RefreshTokenDocument>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private accessTtlMs(): number {
    return this.config.getOrThrow<number>("ACCESS_TOKEN_TTL_MINUTES") * MINUTE;
  }

  private refreshTtlMs(): number {
    const days = this.config.getOrThrow<number>("REFRESH_TOKEN_TTL_DAYS");
    return days * 24 * 60 * MINUTE;
  }

  async issue(
    subject: TokenSubject,
    context: { ip?: string; userAgent?: string; family?: string },
  ): Promise<IssuedSession> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: subject.id.toString(),
        role: subject.role,
        gymId: subject.gymId?.toString(),
        ver: subject.tokenVersion,
      },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: Math.floor(this.accessTtlMs() / 1000),
      },
    );

    // The refresh token is opaque: its only meaning is the row it hashes to.
    const refreshToken = randomBytes(48).toString("base64url");

    await this.refreshTokens.create({
      userId: subject.id,
      tokenHash: this.hashToken(refreshToken),
      family: context.family ?? randomUUID(),
      expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      ip: context.ip,
      userAgent: context.userAgent?.slice(0, 200),
    });

    return {
      accessToken,
      refreshToken,
      csrfToken: randomBytes(24).toString("base64url"),
    };
  }

  /**
   * Swaps a refresh token for a new pair. A token that has already been used
   * means someone is replaying a stolen one, so the whole family is revoked and
   * both parties have to sign in again.
   */
  async rotate(
    presented: string,
    context: { ip?: string; userAgent?: string },
    lookup: (userId: Types.ObjectId) => Promise<TokenSubject | null>,
  ): Promise<IssuedSession> {
    const tokenHash = this.hashToken(presented);
    const row = await this.refreshTokens.findOne({ tokenHash });

    if (!row) throw new UnauthorizedException("Session not recognised");

    if (row.revokedAt) {
      await this.revokeFamily(row.family);
      throw new UnauthorizedException("Session reused — please sign in again");
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Session has expired");
    }

    const subject = await lookup(row.userId);
    if (!subject) throw new UnauthorizedException("Account is unavailable");

    const issued = await this.issue(subject, { ...context, family: row.family });

    row.revokedAt = new Date();
    row.replacedByHash = this.hashToken(issued.refreshToken);
    await row.save();

    return issued;
  }

  async revoke(presented: string): Promise<void> {
    await this.refreshTokens.updateOne(
      { tokenHash: this.hashToken(presented), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeFamily(family: string): Promise<void> {
    await this.refreshTokens.updateMany(
      { family, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  /** Signing out everywhere, e.g. after a password change. */
  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.refreshTokens.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  /**
   * Where the browser thinks the API lives. A cookie's path is matched against
   * the URL in the address bar, not the one the server saw — so when the app
   * proxies the API under a prefix, the refresh cookie has to be scoped to the
   * proxied path or the browser will never send it back.
   */
  private get pathPrefix(): string {
    const raw = this.config.get<string>("COOKIE_PATH_PREFIX") ?? "";
    return raw.replace(/\/$/, "");
  }

  writeCookies(response: Response, session: IssuedSession): void {
    const secure = this.config.getOrThrow<boolean>("COOKIE_SECURE");
    const domain = this.config.get<string>("COOKIE_DOMAIN");
    const base = { httpOnly: true, secure, sameSite: "lax" as const, domain };
    const refreshPath = `${this.pathPrefix}/auth`;

    response.cookie(ACCESS_COOKIE, session.accessToken, {
      ...base,
      path: "/",
      maxAge: this.accessTtlMs(),
    });

    // The refresh cookie is only ever sent to the endpoints that rotate it.
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...base,
      path: refreshPath,
      maxAge: this.refreshTtlMs(),
    });

    // Readable by design: the browser echoes it back as a header.
    response.cookie(CSRF_COOKIE, session.csrfToken, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      domain,
      path: "/",
      maxAge: this.refreshTtlMs(),
    });
  }

  clearCookies(response: Response): void {
    const secure = this.config.getOrThrow<boolean>("COOKIE_SECURE");
    const domain = this.config.get<string>("COOKIE_DOMAIN");
    const base = { secure, sameSite: "lax" as const, domain };

    response.clearCookie(ACCESS_COOKIE, { ...base, httpOnly: true, path: "/" });
    // Must match the path it was written with, or the browser keeps it.
    response.clearCookie(REFRESH_COOKIE, {
      ...base,
      httpOnly: true,
      path: `${this.pathPrefix}/auth`,
    });
    response.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false, path: "/" });
  }
}
