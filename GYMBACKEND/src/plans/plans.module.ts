import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PlansService } from "@/plans/plans.service";
import { Plan, PlanSchema } from "@/plans/schemas/plan.schema";

/**
 * Plans are always reached through a gym, so the HTTP surface lives in
 * GymsModule; this module owns the collection and the service only.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Plan.name, schema: PlanSchema }]),
  ],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
