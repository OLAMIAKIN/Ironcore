import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DayPassesController } from "@/daypasses/daypasses.controller";
import { DayPassesService } from "@/daypasses/daypasses.service";
import { DayPass, DayPassSchema } from "@/daypasses/schemas/day-pass.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DayPass.name, schema: DayPassSchema }]),
  ],
  controllers: [DayPassesController],
  providers: [DayPassesService],
  exports: [DayPassesService, MongooseModule],
})
export class DayPassesModule {}
