import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ReportsService } from "@/transactions/reports.service";
import {
  Transaction,
  TransactionSchema,
} from "@/transactions/schemas/transaction.schema";

/** Owns the ledger collection and the read models built on top of it. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  providers: [ReportsService],
  exports: [ReportsService, MongooseModule],
})
export class TransactionsModule {}
