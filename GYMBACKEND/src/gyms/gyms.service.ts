import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, PipelineStage, Types } from "mongoose";
import { paginate, type Paginated } from "@/common/dto/pagination.dto";
import { slugify } from "@/common/utils/reference";
import type { AuthUser } from "@/common/types";
import { PlansService } from "@/plans/plans.service";
import { GeocodingService } from "@/gyms/geocoding.service";
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
} from "@/payments/providers/provider.port";
import { Gym, type GymDocument } from "@/gyms/schemas/gym.schema";
import type {
  FindGymsQuery,
  ResolveAccountDto,
  SetSettlementAccountDto,
  UpdateGymDto,
} from "@/gyms/dto/gym.dto";

/** What the public sees about a gym. No owner, no bank details, no ids beyond its own. */
export type PublicGym = {
  id: string;
  /** Where the gym is, once someone has placed its pin. */
  lat?: number;
  lng?: number;
  /** How far from the member who asked, in km. Absent if they did not say. */
  distanceKm?: number;
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
    /**
     * True when the account was registered with a different payment gateway
     * than the one now running — its handles are dead and the owner has to add
     * the account again before the gym can take money.
     */
    needsReconnect: boolean;
  };
};

@Injectable()
export class GymsService implements OnModuleInit {
  private readonly logger = new Logger("Gyms");

  /**
   * `$geoNear` refuses to run without a 2dsphere index, and Mongoose only
   * builds schema indexes when `autoIndex` is on — which it deliberately is not
   * in production. So the one index a query hard-depends on is created here,
   * explicitly and idempotently, rather than left to a manual step someone has
   * to remember on every new deployment.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.gyms.collection.createIndex(
        { location: "2dsphere" },
        { sparse: true, background: true, name: "location_2dsphere" },
      );
    } catch (cause: unknown) {
      // Not fatal: everything except "nearest first" works without it.
      this.logger.warn(`Could not ensure the location index: ${String(cause)}`);
    }
  }

  constructor(
    @InjectModel(Gym.name) private readonly gyms: Model<GymDocument>,
    private readonly plans: PlansService,
    private readonly geocoding: GeocodingService,
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

    // A first guess at the pin, from the only address parts sign-up asks for.
    // Deliberately not awaited: an owner should not wait on a third-party
    // geocoder to finish signing up, and a gym without a pin is still fine.
    void this.placeApproximately(gym._id, input.branch, input.area);

    return gym;
  }

  /**
   * Best-effort background pin, so a new gym appears under "near me" without
   * anyone opening Setup. It is neighbourhood-accurate at best — the owner can
   * move it — and it never overwrites a pin that is already there.
   */
  private async placeApproximately(
    gymId: Types.ObjectId,
    branch: string,
    area: string,
  ): Promise<void> {
    try {
      const found = await this.geocoding.locate({ branch, area });
      if (!found) return;

      await this.gyms.updateOne(
        { _id: gymId, location: { $exists: false } },
        {
          $set: {
            location: {
              type: "Point",
              coordinates: [found.lng, found.lat],
            },
          },
        },
      );
    } catch (cause: unknown) {
      this.logger.warn(`Could not place ${String(gymId)}: ${String(cause)}`);
    }
  }

  /** Discover. Only active gyms, and only public fields. */
  async findPublic(query: FindGymsQuery): Promise<Paginated<PublicGym>> {
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

    if (query.lat !== undefined && query.lng !== undefined) {
      return this.findNearest(filter, query, query.lat, query.lng);
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

    return paginate(
      rows.map((row) => toPublic(row)),
      total,
      query,
    );
  }

  /**
   * The same list, ordered by how far each gym is from the member.
   *
   * `$geoNear` has to be the first stage of a pipeline, so the search filter
   * rides along in its own `query` option rather than as a later `$match`. Gyms
   * with no pin are absent from the sparse index and drop out entirely — which
   * is the honest answer to "what is near me" for a gym nobody has located.
   */
  private async findNearest(
    filter: FilterQuery<GymDocument>,
    query: FindGymsQuery,
    lat: number,
    lng: number,
  ): Promise<Paginated<PublicGym>> {
    const near: PipelineStage.GeoNear = {
      $geoNear: {
        // GeoJSON is [longitude, latitude] — the reverse of how it is spoken.
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distanceMetres",
        maxDistance: (query.radiusKm ?? 100) * 1000,
        query: filter,
        spherical: true,
      },
    };

    const [rows, counted] = await Promise.all([
      this.gyms.aggregate<GymDocument & { distanceMetres: number }>([
        near,
        { $skip: (query.page - 1) * query.limit },
        { $limit: query.limit },
      ]),
      this.gyms.aggregate<{ count: number }>([near, { $count: "count" }]),
    ]);

    const items = rows.map((row) =>
      // One decimal of a kilometre is as precise as this is ever useful.
      toPublic(row, Math.round(row.distanceMetres / 100) / 10),
    );

    return paginate(items, counted[0]?.count ?? 0, query);
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
    return toOwner(gym, this.provider.name);
  }

  async update(
    gymId: string,
    user: AuthUser,
    dto: UpdateGymDto,
  ): Promise<OwnerGym> {
    const gym = await this.requireStaffGym(gymId, user);

    // The pin arrives as two plain numbers and is stored as GeoJSON, so it is
    // pulled out before the rest of the payload is applied.
    const { lat, lng, ...fields } = dto;

    /**
     * Only fields the request actually sent.
     *
     * A DTO built by class-transformer carries *every* declared property, set
     * to undefined wherever the payload omitted it — class fields are real own
     * properties under this compile target. Copying that across wholesale set
     * `name`, `branch`, `area` and `dayPassPrice` to undefined on a PATCH that
     * never mentioned them, and the save then failed on required fields.
     */
    applyDefined(gym, fields);

    if (lat !== undefined && lng !== undefined) {
      gym.location = { type: "Point", coordinates: [lng, lat] };
    }

    await gym.save();
    return toOwner(gym, this.provider.name);
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
      // Resolved from the bank just above, so the gateway is told who actually
      // holds the account rather than being handed the gym's name for it.
      accountName,
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
      // Stamped so a later switch of gateway can be spotted rather than
      // discovered as a failed payment.
      provider: this.provider.name,
      verifiedAt: new Date(),
    };
    await gym.save();

    return toOwner(gym, this.provider.name);
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

function toPublic(
  gym: Gym & { _id: Types.ObjectId },
  /** Only present when the caller told us where they were. */
  distanceKm?: number,
): PublicGym {
  const [lng, lat] = gym.location?.coordinates ?? [];

  return {
    id: gym._id.toString(),
    name: gym.name,
    branch: gym.branch,
    area: gym.area,
    slug: gym.slug,
    dayPassPrice: gym.dayPassPrice,
    about: gym.about,
    lat,
    lng,
    distanceKm,
  };
}

function toOwner(gym: GymDocument, provider: string): OwnerGym {
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
          needsReconnect: !settlementMatchesProvider(gym, provider),
        }
      : undefined,
  };
}

/**
 * Copies only the keys that carry a real value.
 *
 * A DTO built by class-transformer carries *every* declared property, set to
 * undefined wherever the request omitted it — under this compile target class
 * fields are real own properties. Assigning that wholesale set `name`,
 * `branch`, `area` and `dayPassPrice` to undefined on a PATCH that never
 * mentioned them, and the save then failed on required fields.
 */
export function applyDefined(
  target: { set: (path: string, value: unknown) => unknown },
  source: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) target.set(key, value);
  }
}

/**
 * Whether the stored payout handles were issued by the gateway now in use.
 * Accounts saved before the issuer was recorded are treated as stale, because
 * that is exactly the case this check exists to catch.
 */
export function settlementMatchesProvider(
  gym: Pick<GymDocument, "settlementAccount">,
  provider: string,
): boolean {
  return gym.settlementAccount?.provider === provider;
}
