import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DayPassesModule } from "@/daypasses/daypasses.module";
import { GymsModule } from "@/gyms/gyms.module";
import { PlansModule } from "@/plans/plans.module";
import { SubscriptionsModule } from "@/subscriptions/subscriptions.module";
import { TransactionsModule } from "@/transactions/transactions.module";
import { UsersModule } from "@/users/users.module";
import { PaymentsController } from "@/payments/payments.controller";
import { PaymentsService } from "@/payments/payments.service";
import {
  WebhookEvent,
  WebhookEventSchema,
} from "@/payments/schemas/webhook-event.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
    TransactionsModule,
    UsersModule,
    GymsModule,
    PlansModule,
    SubscriptionsModule,
    DayPassesModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
