import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import type { AuthUser } from "@/common/types";
import { GymsService } from "@/gyms/gyms.service";
import { PlansService } from "@/plans/plans.service";
import { CreatePlanDto, UpdatePlanDto } from "@/plans/dto/plan.dto";

@Controller("gyms/:gymId/plans")
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly gyms: GymsService,
  ) {}

  /** What a member sees on the renewal screen. */
  @Public()
  @Get()
  async list(@Param("gymId") gymId: string) {
    await this.gyms.requireGym(gymId);
    return { items: await this.plans.listActive(gymId) };
  }

  @Roles("owner", "manager")
  @Get("all")
  async listAll(@Param("gymId") gymId: string, @CurrentUser() user: AuthUser) {
    await this.gyms.requireStaffGym(gymId, user);
    return { items: await this.plans.listAll(gymId) };
  }

  @Roles("owner")
  @Post()
  async create(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePlanDto,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    return this.plans.create(gymId, dto);
  }

  @Roles("owner")
  @Patch(":planId")
  async update(
    @Param("gymId") gymId: string,
    @Param("planId") planId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePlanDto,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    return this.plans.update(gymId, planId, dto);
  }

  @Roles("owner")
  @Delete(":planId")
  @HttpCode(204)
  async retire(
    @Param("gymId") gymId: string,
    @Param("planId") planId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    await this.plans.retire(gymId, planId);
  }
}
