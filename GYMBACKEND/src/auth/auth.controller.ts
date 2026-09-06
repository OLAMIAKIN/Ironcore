import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { SkipCsrf } from "@/common/decorators/skip-csrf.decorator";
import { REFRESH_COOKIE } from "@/common/guards/jwt-auth.guard";
import type { AuthUser } from "@/common/types";
import { AuthService } from "@/auth/auth.service";
import { TokensService } from "@/auth/tokens.service";
import {
  ChangePasswordDto,
  LoginDto,
  RegisterGymDto,
  RegisterMemberDto,
} from "@/auth/dto/auth.dto";
import type { UserDocument } from "@/users/schemas/user.schema";

/** Sign-in and registration are the endpoints worth brute-forcing; rate-limit hard. */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Public()
  @SkipCsrf()
  @Throttle(STRICT)
  @Post("register/member")
  async registerMember(
    @Body() dto: RegisterMemberDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.auth.registerMember(dto);
    return this.startSession(user, request, response);
  }

  /**
   * Creates the owner and their gym in one call. The gym starts as a draft: it
   * is invisible in search and cannot take payments until the listing payment
   * clears, which is the next step in onboarding.
   */
  @Public()
  @SkipCsrf()
  @Throttle(STRICT)
  @Post("register/gym")
  async registerGym(
    @Body() dto: RegisterGymDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { owner, gymId } = await this.auth.registerGym(dto);
    const session = await this.startSession(owner, request, response);
    return { ...session, gymId: gymId.toString() };
  }

  @Public()
  @SkipCsrf()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.auth.login(dto);
    return this.startSession(user, request, response);
  }

  /**
   * Rotates the session. Public because the access token is expected to be
   * expired by the time anyone calls this — the refresh cookie is the credential.
   */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, string> | undefined;
    const presented = cookies?.[REFRESH_COOKIE];
    if (!presented) throw new UnauthorizedException("No session to refresh");

    const issued = await this.tokens.rotate(
      presented,
      { ip: request.ip, userAgent: request.get("user-agent") },
      (userId: Types.ObjectId) => this.auth.subjectOf(userId),
    );

    this.tokens.writeCookies(response, issued);
    return { ok: true };
  }

  @Public()
  @SkipCsrf()
  @HttpCode(200)
  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, string> | undefined;
    const presented = cookies?.[REFRESH_COOKIE];
    if (presented) await this.tokens.revoke(presented);

    this.tokens.clearCookies(response);
    return { ok: true };
  }

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    const found = await this.auth.findById(user.id);
    if (!found) throw new UnauthorizedException("Account is unavailable");
    return { user: this.auth.toPublic(found) };
  }

  /** Changing a password signs every other device out. */
  @HttpCode(200)
  @Post("change-password")
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    await this.tokens.revokeAllForUser(new Types.ObjectId(user.id));
    this.tokens.clearCookies(response);
    return { ok: true };
  }

  private async startSession(
    user: UserDocument,
    request: Request,
    response: Response,
  ) {
    const issued = await this.tokens.issue(
      {
        id: user._id,
        role: user.role,
        gymId: user.gymId,
        tokenVersion: user.tokenVersion,
      },
      { ip: request.ip, userAgent: request.get("user-agent") },
    );

    this.tokens.writeCookies(response, issued);
    return { user: this.auth.toPublic(user) };
  }
}
