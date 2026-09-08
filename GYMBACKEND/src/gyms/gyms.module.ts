import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PlansController } from "@/plans/plans.controller";
import { PlansModule } from "@/plans/plans.module";
import { GymsController } from "@/gyms/gyms.controller";
import { GymsService } from "@/gyms/gyms.service";
import { GeocodingService } from "@/gyms/geocoding.service";
import { Gym, GymSchema } from "@/gyms/schemas/gym.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Gym.name, schema: GymSchema }]),
    PlansModule,
  ],
  controllers: [GymsController, PlansController],
  providers: [GymsService, GeocodingService],
  exports: [GymsService, GeocodingService, MongooseModule],
})
export class GymsModule {}
