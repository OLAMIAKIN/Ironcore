import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { GymsModule } from "@/gyms/gyms.module";
import { PlansModule } from "@/plans/plans.module";
import { UsersModule } from "@/users/users.module";
import { SettlementsModule } from "@/settlements/settlements.module";
import { SubscriptionsModule } from "@/subscriptions/subscriptions.module";
import { TransactionsModule } from "@/transactions/transactions.module";
import { ReportsController } from "@/transactions/reports.controller";
import { SubscriptionsController } from "@/subscriptions/subscriptions.controller";

/**
 * The read side: the owner's money screens and the member's own history. Kept
 * apart from the ledger module so writes and reads can evolve separately.
 */
@Module({
  imports: [
    TransactionsModule,
    SubscriptionsModule,
    SettlementsModule,
    GymsModule,
    PlansModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [ReportsController, SubscriptionsController],
})
export class ReportsModule {}
