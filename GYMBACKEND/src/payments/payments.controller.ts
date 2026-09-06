import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { SkipCsrf } from "@/common/decorators/skip-csrf.decorator";
import type { AuthUser } from "@/common/types";
import { PaymentsService } from "@/payments/payments.service";
import {
  InitializePaymentDto,
  SimulatePaymentDto,
} from "@/payments/dto/payment.dto";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Opens a checkout. The server decides the amount; the client cannot. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("initialize")
  initialize(@CurrentUser() user: AuthUser, @Body() dto: InitializePaymentDto) {
    return this.payments.initialize(user, dto);
  }

  @Get(":reference")
  status(@CurrentUser() user: AuthUser, @Param("reference") reference: string) {
    return this.payments.status(user, reference);
  }

  /** Sandbox only — refused outright when a real gateway is configured. */
  @HttpCode(200)
  @Post(":reference/simulate")
  simulate(
    @CurrentUser() user: AuthUser,
    @Param("reference") reference: string,
    @Body() dto: SimulatePaymentDto,
  ) {
    return this.payments.simulate(user, reference, dto);
  }

  /**
   * Gateway callback. No session and no CSRF token — the signature over the
   * raw body is the only thing that authenticates it.
   */
  @Public()
  @SkipCsrf()
  @HttpCode(200)
  @Post("webhook/paystack")
  async webhook(
    @Req() request: Request,
    @Headers("x-paystack-signature") signature?: string,
  ) {
    const raw = (request as Request & { rawBody?: Buffer }).rawBody;
    await this.payments.handleWebhook(raw ?? Buffer.alloc(0), signature);
    return { received: true };
  }
}
