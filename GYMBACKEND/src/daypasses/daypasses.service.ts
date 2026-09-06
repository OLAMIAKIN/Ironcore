import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { accessToken } from "@/common/utils/reference";
import { DayPass, type DayPassDocument } from "@/daypasses/schemas/day-pass.schema";

type PopulatedGym = {
  _id: Types.ObjectId;
  name: string;
  branch: string;
  area: string;
};

/**
 * A pass with its gym resolved. The member's screen shows the pass on its own,
 * long after the gym list that was on screen when they bought it has gone.
 */
export type PassWithGym = Omit<DayPassDocument, "gymId"> & {
  gymId: PopulatedGym;
};

/** Passes expire at the end of the day they were bought, local time. */
function endOfToday(): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

@Injectable()
export class DayPassesService {
  constructor(
    @InjectModel(DayPass.name)
    private readonly passes: Model<DayPassDocument>,
  ) {}

  async issue(input: {
    gymId: Types.ObjectId;
    buyerId?: Types.ObjectId;
    buyerName?: string;
    transactionId: Types.ObjectId;
  }): Promise<DayPassDocument> {
    return this.passes.create({
      ...input,
      token: accessToken("TKN"),
      validUntil: endOfToday(),
    });
  }

  async findByToken(
    gymId: Types.ObjectId,
    token: string,
  ): Promise<DayPassDocument | null> {
    return this.passes.findOne({ gymId, token: token.toUpperCase() });
  }

  /**
   * Single entry: the first scan wins. The conditional update is what stops two
   * simultaneous scans both being let in.
   */
  async consume(passId: Types.ObjectId): Promise<boolean> {
    const result = await this.passes.updateOne(
      { _id: passId, usedAt: { $exists: false } },
      { $set: { usedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  async listForMember(buyerId: string): Promise<PassWithGym[]> {
    return this.passes
      .find({ buyerId: new Types.ObjectId(buyerId) })
      .populate<{ gymId: PopulatedGym }>("gymId", "name branch area")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<PassWithGym[]>();
  }

  async requireForMember(
    token: string,
    buyerId: string,
  ): Promise<DayPassDocument> {
    const pass = await this.passes.findOne({
      token: token.toUpperCase(),
      buyerId: new Types.ObjectId(buyerId),
    });
    if (!pass) throw new NotFoundException("Pass not found");
    return pass;
  }
}
