import { Controller, Get, Param, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { PaginationQuery } from "@/common/dto/pagination.dto";
import type { AuthUser } from "@/common/types";
import { GymsService } from "@/gyms/gyms.service";
import { SettlementsService } from "@/settlements/settlements.service";
import { SubscriptionsService } from "@/subscriptions/subscriptions.service";
import { ReportsService } from "@/transactions/reports.service";

class PeriodQuery extends PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 14;
}

/**
 * The owner's money screens. Every amount returned here is the gym's own
 * share — the platform fee is not part of any response on this controller.
 */
@Controller("gyms/:gymId")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly settlements: SettlementsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly gyms: GymsService,
  ) {}

  @Roles("owner")
  @Get("payments/summary")
  async summary(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: PeriodQuery,
  ) {
    await this.gyms.requireStaffGym(gymId, user);

    const [summary, activeMembers] = await Promise.all([
      this.reports.summary(gymId, query.days),
      this.subscriptions.countActive(gymId),
    ]);

    return { ...summary, activeMembers };
  }

  @Roles("owner")
  @Get("payments/daily")
  async daily(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: PeriodQuery,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    return { items: await this.reports.daily(gymId, query.days) };
  }

  @Roles("owner")
  @Get("payments")
  async list(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: PeriodQuery,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    return this.reports.list(gymId, query, query.days);
  }

  @Roles("owner")
  @Get("settlements")
  async payouts(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    return { items: await this.settlements.listForGym(gymId) };
  }

  /** The dashboard header: today's takings and who is about to lapse. */
  @Roles("owner", "manager")
  @Get("overview")
  async overview(@Param("gymId") gymId: string, @CurrentUser() user: AuthUser) {
    await this.gyms.requireStaffGym(gymId, user);

    const [today, activeMembers, expiring] = await Promise.all([
      this.reports.today(gymId),
      this.subscriptions.countActive(gymId),
      this.subscriptions.expiringSoon(gymId),
    ]);

    return { today, activeMembers, expiring };
  }
}
