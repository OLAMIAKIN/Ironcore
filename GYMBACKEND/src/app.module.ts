import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "@/config/env";
import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter";
import { HealthController } from "@/common/health.controller";
import { CsrfGuard } from "@/common/guards/csrf.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthModule } from "@/auth/auth.module";
import { CheckInsModule } from "@/checkins/checkins.module";
import { DayPassesModule } from "@/daypasses/daypasses.module";
import { GymsModule } from "@/gyms/gyms.module";
import { PaymentsModule } from "@/payments/payments.module";
import { PaymentsProviderModule } from "@/payments/providers/payments-provider.module";
import { PlansModule } from "@/plans/plans.module";
import { ReportsModule } from "@/transactions/reports.module";
import { SettlementsModule } from "@/settlements/settlements.module";
import { StaffModule } from "@/staff/staff.module";
import { SubscriptionsModule } from "@/subscriptions/subscriptions.module";
import { TransactionsModule } from "@/transactions/transactions.module";
import { UsersModule } from "@/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGODB_URI"),
        dbName: config.getOrThrow<string>("MONGODB_DB"),
        // A pool sized for a small fleet; Atlas counts connections per cluster.
        maxPoolSize: 20,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10_000,
        autoIndex: config.get("NODE_ENV") !== "production",
      }),
    }),

    // A default ceiling for every route; sensitive ones tighten it further.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    PaymentsProviderModule,
    UsersModule,
    AuthModule,
    GymsModule,
    PlansModule,
    SubscriptionsModule,
    TransactionsModule,
    SettlementsModule,
    DayPassesModule,
    PaymentsModule,
    ReportsModule,
    CheckInsModule,
    StaffModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit, then identity, then CSRF, then role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
