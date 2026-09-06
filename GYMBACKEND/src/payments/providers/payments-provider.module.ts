import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MockPaymentsProvider } from "@/payments/providers/mock.provider";
import { PaystackProvider } from "@/payments/providers/paystack.provider";
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
} from "@/payments/providers/provider.port";

/**
 * Picks the gateway once, at boot, from PAYMENTS_PROVIDER. Global because both
 * payments and gyms (bank lookups) need it, and neither should have to know
 * which adapter it got.
 */
@Global()
@Module({
  providers: [
    MockPaymentsProvider,
    PaystackProvider,
    {
      provide: PAYMENTS_PROVIDER,
      inject: [ConfigService, MockPaymentsProvider, PaystackProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentsProvider,
        paystack: PaystackProvider,
      ): PaymentsProvider => {
        const chosen = config.getOrThrow<"mock" | "paystack">(
          "PAYMENTS_PROVIDER",
        );
        new Logger("Payments").log(`Gateway: ${chosen}`);
        return chosen === "paystack" ? paystack : mock;
      },
    },
  ],
  exports: [PAYMENTS_PROVIDER],
})
export class PaymentsProviderModule {}
