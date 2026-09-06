import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { GymsModule } from "@/gyms/gyms.module";
import { TransactionsModule } from "@/transactions/transactions.module";
import { SettlementsService } from "@/settlements/settlements.service";
import {
  Settlement,
  SettlementSchema,
} from "@/settlements/schemas/settlement.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Settlement.name, schema: SettlementSchema },
    ]),
    TransactionsModule,
    GymsModule,
  ],
  providers: [SettlementsService],
  exports: [SettlementsService, MongooseModule],
})
export class SettlementsModule {}
