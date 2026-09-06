import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DayPassesModule } from "@/daypasses/daypasses.module";
import { GymsModule } from "@/gyms/gyms.module";
import { SubscriptionsModule } from "@/subscriptions/subscriptions.module";
import { UsersModule } from "@/users/users.module";
import { CheckInsController } from "@/checkins/checkins.controller";
import { CheckInsService } from "@/checkins/checkins.service";
import { CheckIn, CheckInSchema } from "@/checkins/schemas/check-in.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CheckIn.name, schema: CheckInSchema }]),
    UsersModule,
    GymsModule,
    SubscriptionsModule,
    DayPassesModule,
  ],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
