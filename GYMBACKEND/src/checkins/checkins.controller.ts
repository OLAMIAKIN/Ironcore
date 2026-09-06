import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import type { AuthUser } from "@/common/types";
import { GymsService } from "@/gyms/gyms.service";
import { CheckInsService } from "@/checkins/checkins.service";

class ScanDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  token!: string;
}

@Controller("gyms/:gymId/checkins")
export class CheckInsController {
  constructor(
    private readonly checkIns: CheckInsService,
    private readonly gyms: GymsService,
  ) {}

  /**
   * The door. Rate-limited because a scanner is the one screen that faces the
   * street, and a token guesser would live here.
   */
  @Roles("owner", "manager", "scanner")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @Post("scan")
  async scan(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ScanDto,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    return this.checkIns.scan(gymId, dto.token, user.id);
  }

  @Roles("owner", "manager", "scanner")
  @Get("recent")
  async recent(@Param("gymId") gymId: string, @CurrentUser() user: AuthUser) {
    await this.gyms.requireStaffGym(gymId, user);

    const [items, today] = await Promise.all([
      this.checkIns.recent(gymId),
      this.checkIns.countToday(gymId),
    ]);

    return { items, today };
  }
}
