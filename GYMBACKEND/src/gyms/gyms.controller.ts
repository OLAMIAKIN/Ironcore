import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import type { AuthUser } from "@/common/types";
import { LISTING_PLANS } from "@/gyms/listing-plans";
import { GymsService } from "@/gyms/gyms.service";
import { GeocodingService } from "@/gyms/geocoding.service";
import {
  FindGymsQuery,
  GeocodeQuery,
  ResolveAccountDto,
  SetSettlementAccountDto,
  UpdateGymDto,
} from "@/gyms/dto/gym.dto";

@Controller()
export class GymsController {
  constructor(
    private readonly gyms: GymsService,
    private readonly geocoding: GeocodingService,
  ) {}

  /** Discover. Anyone can browse gyms without an account. */
  @Public()
  @Get("gyms")
  list(@Query() query: FindGymsQuery) {
    return this.gyms.findPublic(query);
  }

  /**
   * Address to coordinates, for an owner placing their gym without standing in
   * it. Staff only and rate-limited: it is a paid-for-by-goodwill public
   * geocoder behind this, not something to leave open to the world.
   */
  @Roles("owner", "manager")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("geocode")
  async geocode(@Query() query: GeocodeQuery) {
    return { items: await this.geocoding.search(query.q) };
  }

  @Public()
  @Get("listing-plans")
  listingPlans() {
    return { items: LISTING_PLANS };
  }

  @Public()
  @Get("gyms/:id")
  one(@Param("id") id: string) {
    return this.gyms.findPublicById(id);
  }

  /** The signed-in staff member's own gym, including private fields. */
  @Roles("owner", "manager", "scanner")
  @Get("me/gym")
  mine(@CurrentUser() user: AuthUser) {
    return this.gyms.findForOwner(user.gymId ?? "", user);
  }

  @Roles("owner")
  @Patch("gyms/:gymId")
  update(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateGymDto,
  ) {
    return this.gyms.update(gymId, user, dto);
  }

  @Roles("owner")
  @Get("banks")
  banks() {
    return this.gyms.listBanks().then((items) => ({ items }));
  }

  /** Name lookup is a paid call at the real provider — keep it slow on purpose. */
  @Roles("owner")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("banks/resolve")
  resolve(@Body() dto: ResolveAccountDto) {
    return this.gyms.resolveAccount(dto);
  }

  @Roles("owner")
  @Put("gyms/:gymId/settlement-account")
  setAccount(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetSettlementAccountDto,
  ) {
    return this.gyms.setSettlementAccount(gymId, user, dto);
  }
}
