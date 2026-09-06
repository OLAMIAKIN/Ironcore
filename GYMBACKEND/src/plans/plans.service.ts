import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Plan, type PlanDocument } from "@/plans/schemas/plan.schema";
import type { CreatePlanDto, UpdatePlanDto } from "@/plans/dto/plan.dto";

/** What a new gym starts with; the owner edits or deletes them afterwards. */
const STARTER_PLANS = [
  {
    name: "Monthly",
    price: 15000,
    durationDays: 30,
    perks: "Full gym access + 2 trainer sessions",
    popular: true,
  },
  {
    name: "Quarterly",
    price: 40000,
    durationDays: 90,
    perks: "Full gym access + 6 trainer sessions",
    popular: false,
  },
  {
    name: "Annual",
    price: 140000,
    durationDays: 365,
    perks: "Full gym access + unlimited trainer sessions",
    popular: false,
  },
];

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan.name) private readonly plans: Model<PlanDocument>,
  ) {}

  async createDefaults(gymId: Types.ObjectId): Promise<void> {
    await this.plans.insertMany(
      STARTER_PLANS.map((plan) => ({ ...plan, gymId })),
    );
  }

  /** Public listing for a gym — only plans currently on sale. */
  async listActive(gymId: string): Promise<PlanDocument[]> {
    return this.plans
      .find({ gymId: new Types.ObjectId(gymId), active: true })
      .sort({ price: 1 })
      .lean<PlanDocument[]>();
  }

  /** The owner's view, which includes retired plans. */
  async listAll(gymId: string): Promise<PlanDocument[]> {
    return this.plans
      .find({ gymId: new Types.ObjectId(gymId) })
      .sort({ active: -1, price: 1 })
      .lean<PlanDocument[]>();
  }

  async create(gymId: string, dto: CreatePlanDto): Promise<PlanDocument> {
    return this.plans.create({ ...dto, gymId: new Types.ObjectId(gymId) });
  }

  async update(
    gymId: string,
    planId: string,
    dto: UpdatePlanDto,
  ): Promise<PlanDocument> {
    const plan = await this.plans.findOneAndUpdate(
      { _id: new Types.ObjectId(planId), gymId: new Types.ObjectId(gymId) },
      { $set: dto },
      { new: true },
    );
    if (!plan) throw new NotFoundException("Plan not found");
    return plan;
  }

  /**
   * Plans are retired rather than deleted — subscriptions and receipts point at
   * them, and history should not develop holes.
   */
  async retire(gymId: string, planId: string): Promise<void> {
    const result = await this.plans.updateOne(
      { _id: new Types.ObjectId(planId), gymId: new Types.ObjectId(gymId) },
      { $set: { active: false } },
    );
    if (result.matchedCount === 0) throw new NotFoundException("Plan not found");
  }

  /** Used at checkout: the plan must belong to the gym being paid. */
  async requireForGym(
    planId: string,
    gymId: Types.ObjectId,
  ): Promise<PlanDocument> {
    if (!Types.ObjectId.isValid(planId)) {
      throw new NotFoundException("Plan not found");
    }

    const plan = await this.plans.findById(planId);
    if (!plan) throw new NotFoundException("Plan not found");
    if (!plan.gymId.equals(gymId)) {
      throw new ForbiddenException("That plan belongs to another gym");
    }
    if (!plan.active) {
      throw new ForbiddenException("That plan is no longer on sale");
    }
    return plan;
  }
}
