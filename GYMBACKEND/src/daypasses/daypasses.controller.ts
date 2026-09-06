import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import type { AuthUser } from "@/common/types";
import { DayPassesService } from "@/daypasses/daypasses.service";

@Controller("me/day-passes")
export class DayPassesController {
  constructor(private readonly passes: DayPassesService) {}

  @Roles("member")
  @Get()
  async mine(@CurrentUser() user: AuthUser) {
    const rows = await this.passes.listForMember(user.id);

    return {
      items: rows.map((row) => ({
        id: row._id.toString(),
        token: row.token,
        gymId: row.gymId.toString(),
        validUntil: row.validUntil,
        usedAt: row.usedAt,
      })),
    };
  }

  @Roles("member")
  @Get(":token")
  async one(@CurrentUser() user: AuthUser, @Param("token") token: string) {
    const pass = await this.passes.requireForMember(token, user.id);

    return {
      id: pass._id.toString(),
      token: pass.token,
      gymId: pass.gymId.toString(),
      validUntil: pass.validUntil,
      usedAt: pass.usedAt,
    };
  }
}
