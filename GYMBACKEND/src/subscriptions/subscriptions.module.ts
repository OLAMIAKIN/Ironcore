import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SubscriptionsService } from "@/subscriptions/subscriptions.service";
import {
  Subscription,
  SubscriptionSchema,
} from "@/subscriptions/schemas/subscription.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService, MongooseModule],
})
export class SubscriptionsModule {}
