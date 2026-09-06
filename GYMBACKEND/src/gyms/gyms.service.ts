import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types } from "mongoose";
import { paginate, type Paginated, type PaginationQuery } from "@/common/dto/pagination.dto";
import { slugify } from "@/common/utils/reference";
import type { AuthUser } from "@/common/types";
import { PlansService } from "@/plans/plans.service";
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
} from "@/payments/providers/provider.port";
import { Gym, type GymDocument } from "@/gyms/schemas/gym.schema";
import type {
  ResolveAccountDto,
  SetSettlementAccountDto,
  UpdateGymDto,
} from "@/gyms/dto/gym.dto";

/** What the public sees about a gym. No owner, no bank details, no ids beyond its own. */
export type PublicGym = {
  id: string;
  name: string;
  branch: string;
  area: string;
  slug: string;
  dayPassPrice: number;
  about?: string;
};

export type OwnerGym = PublicGym & {
  status: Gym["status"];
  listing?: {
    planId: string;
    planName: string;
    price: number;
    status: string;
    currentPeriodEnd?: Date;
  };
  settlementAccount?: {
    bankName: string;
    accountName: string;
    /** Only the last four digits ever leave the server. */
    accountLast4: string;
    verifiedAt?: Date;
  };
};

@Injectable()
export class GymsService {
  constructor(
    @InjectModel(Gym.name) private readonly gyms: Model<GymDocument>,
    private readonly plans: PlansService,
    private readonly config: ConfigService,
    @Inject(PAYMENTS_PROVIDER) private readonly provider: PaymentsProvider,
  ) {}

  async createDraft(
    input: { name: string; branch: string; area: string; dayPassPrice: number },
    ownerId: Types.ObjectId,
  ): Promise<GymDocument> {
    const gym = await this.gyms.create({
      ...input,
      slug: await this.uniqueSlug(`${input.name} ${input.branch}`),
      ownerId,
      status: "draft",
    });

    // A gym with nothing to sell is a dead end, so it starts with three plans.
    await this.plans.createDefaults(gym._id);

    return gym;
  }

  /** Discover. Only active gyms, and only public fields. */
  async findPublic(query: PaginationQuery): Promise<Paginated<PublicGym>> {
    const filter: FilterQuery<GymDocument> = { status: "active" };

    if (query.q) {
      // Escaped, so a search box cannot smuggle in a regular expression.
      const safe = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { area: { $regex: safe, $options: "i" } },
        { branch: { $regex: safe, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.gyms
        .find(filter)
        .sort({ name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.gyms.countDocuments(filter),
    ]);

    return paginate(rows.map(toPublic), total, query);
  }

  async findPublicById(id: string): Promise<PublicGym> {
    const gym = await this.requireGym(id);
    if (gym.status !== "active") throw new NotFoundException("Gym not found");
    return toPublic(gym);
  }

  async requireGym(id: string): Promise<GymDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("Gym not found");
    const gym = await this.gyms.findById(id);
    if (!gym) throw new NotFoundException("Gym not found");
    return gym;
  }

  /**
   * Staff may only ever touch their own gym. Every gym-scoped route runs this
   * before it does anything else.
   */
  async requireStaffGym(gymId: string, user: AuthUser): Promise<GymDocument> {
    if (!user.gymId || user.gymId !== gymId) {
      throw new ForbiddenException("That gym is not yours");
    }
    return this.requireGym(gymId);
  }

  async findForOwner(gymId: string, user: AuthUser): Promise<OwnerGym> {
    const gym = await this.requireStaffGym(gymId, user);
    return toOwner(gym);
  }

  async update(
    gymId: string,
    user: AuthUser,
    dto: UpdateGymDto,
  ): Promise<OwnerGym> {
    const gym = await this.requireStaffGym(gymId, user);
    Object.assign(gym, dto);
    await gym.save();
    return toOwner(gym);
  }

  listBanks() {
    return this.provider.listBanks();
  }

  /** Name lookup before saving, so the owner sees whose account it is. */
  async resolveAccount(dto: ResolveAccountDto) {
    return this.provider.resolveAccount(dto);
  }

  /**
   * Onboarding step two: where the gym's share of every payment is settled.
   * Required before the gym can go live, because otherwise its money has
   * nowhere to land.
   */
  async setSettlementAccount(
    gymId: string,
    user: AuthUser,
    dto: SetSettlementAccountDto,
  ): Promise<OwnerGym> {
    const gym = await this.requireStaffGym(gymId, user);

    const banks = await this.provider.listBanks();
    const bank = banks.find((candidate) => candidate.code === dto.bankCode);
    if (!bank) throw new BadRequestException("Choose a bank from the list");

    const { accountName } = await this.provider.resolveAccount(dto);

    const handles = await this.provider.registerSettlementAccount({
      gymName: `${gym.name} — ${gym.branch}`,
      bankCode: dto.bankCode,
      accountNumber: dto.accountNumber,
      feeRate: this.config.getOrThrow<number>("PLATFORM_FEE_RATE"),
    });

    gym.settlementAccount = {
      bankCode: dto.bankCode,
      bankName: bank.name,
      accountNumber: dto.accountNumber,
      accountName,
      subaccountCode: handles.subaccountCode,
      recipientCode: handles.recipientCode,
      verifiedAt: new Date(),
    };
    await gym.save();

    return toOwner(gym);
  }

  /** Called by payments once a listing payment succeeds. */
  async activateListing(
    gymId: Types.ObjectId,
    listing: {
      planId: string;
      planName: string;
      price: number;
      durationDays: number;
      reference: string;
    },
  ): Promise<void> {
    const now = Date.now();
    await this.gyms.updateOne(
      { _id: gymId },
      {
        $set: {
          status: "active",
          listing: {
            planId: listing.planId,
            planName: listing.planName,
            price: listing.price,
            status: "active",
            currentPeriodEnd: new Date(
              now + listing.durationDays * 24 * 60 * 60 * 1000,
            ),
            lastReference: listing.reference,
          },
        },
      },
    );
  }

  /** A gym can only take member payments once it is live and has an account. */
  assertCanTakePayments(gym: GymDocument): void {
    if (gym.status !== "active") {
      throw new ForbiddenException("This gym is not live yet");
    }
    if (!gym.settlementAccount) {
      throw new ForbiddenException(
        "This gym has not added a settlement account yet",
      );
    }
  }

  private async uniqueSlug(source: string): Promise<string> {
    const base = slugify(source) || "gym";
    let candidate = base;

    for (let suffix = 2; suffix < 50; suffix += 1) {
      const taken = await this.gyms.exists({ slug: candidate });
      if (!taken) return candidate;
      candidate = `${base}-${suffix}`;
    }

    return `${base}-${Date.now()}`;
  }
}

function toPublic(gym: Gym & { _id: Types.ObjectId }): PublicGym {
  return {
    id: gym._id.toString(),
    name: gym.name,
    branch: gym.branch,
    area: gym.area,
    slug: gym.slug,
    dayPassPrice: gym.dayPassPrice,
    about: gym.about,
  };
}

function toOwner(gym: GymDocument): OwnerGym {
  return {
    ...toPublic(gym),
    status: gym.status,
    listing: gym.listing
      ? {
          planId: gym.listing.planId,
          planName: gym.listing.planName,
          price: gym.listing.price,
          status: gym.listing.status,
          currentPeriodEnd: gym.listing.currentPeriodEnd,
        }
      : undefined,
    settlementAccount: gym.settlementAccount
      ? {
          bankName: gym.settlementAccount.bankName,
          accountName: gym.settlementAccount.accountName,
          accountLast4: gym.settlementAccount.accountNumber.slice(-4),
          verifiedAt: gym.settlementAccount.verifiedAt,
        }
      : undefined,
  };
}
