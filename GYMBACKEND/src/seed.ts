// Same resolver workaround the API uses; without it the seed cannot reach
// Atlas on a network whose DNS will not answer SRV lookups.
import "@/config/dns";
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AppModule } from "@/app.module";
import { PasswordService } from "@/auth/password.service";
import { splitOf } from "@/common/utils/money";
import { accessToken, paymentReference } from "@/common/utils/reference";
import { Gym, type GymDocument } from "@/gyms/schemas/gym.schema";
import { Plan, type PlanDocument } from "@/plans/schemas/plan.schema";
import {
  Subscription,
  type SubscriptionDocument,
} from "@/subscriptions/schemas/subscription.schema";
import {
  Transaction,
  type TransactionDocument,
} from "@/transactions/schemas/transaction.schema";
import { User, type UserDocument } from "@/users/schemas/user.schema";

/**
 * Fills an empty database with one worked-through gym: staff, members with
 * live subscriptions, and a fortnight of payments in both settlement states.
 *
 * Safe to re-run — it clears the demo gym first. Never point this at a
 * database that holds real accounts.
 */

const DEMO_PASSWORD = "ironcore123";

const MEMBERS = [
  { name: "Chidinma Okafor", phone: "08032147765", plan: "Monthly", daysLeft: 14 },
  { name: "Tunde Adisa", phone: "08064412210", plan: "Monthly", daysLeft: 2 },
  { name: "Bisi Fashola", phone: "08071189043", plan: "Monthly", daysLeft: 4 },
  { name: "Emeka Nnamdi", phone: "08093307712", plan: "Quarterly", daysLeft: 6 },
  { name: "Zainab Yusuf", phone: "08102245566", plan: "Monthly", daysLeft: 7 },
  { name: "Segun Adeyemi", phone: "08055520912", plan: "Annual", daysLeft: 0 },
];

const PAYMENT_DAYS = [
  { daysAgo: 0, member: 0, kind: "subscription" as const },
  { daysAgo: 0, member: 1, kind: "day_pass" as const },
  { daysAgo: 1, member: 2, kind: "subscription" as const },
  { daysAgo: 2, member: 3, kind: "subscription" as const },
  { daysAgo: 3, member: 4, kind: "subscription" as const },
  { daysAgo: 4, member: 0, kind: "day_pass" as const },
  { daysAgo: 5, member: 5, kind: "subscription" as const },
  { daysAgo: 6, member: 1, kind: "subscription" as const },
  { daysAgo: 7, member: 2, kind: "day_pass" as const },
  { daysAgo: 8, member: 3, kind: "subscription" as const },
  { daysAgo: 9, member: 4, kind: "subscription" as const },
  { daysAgo: 10, member: 0, kind: "subscription" as const },
  { daysAgo: 11, member: 5, kind: "day_pass" as const },
  { daysAgo: 12, member: 1, kind: "subscription" as const },
  { daysAgo: 13, member: 2, kind: "subscription" as const },
  { daysAgo: 14, member: 3, kind: "subscription" as const },
];

async function seed(): Promise<void> {
  const logger = new Logger("Seed");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const config = app.get(ConfigService);
  if (config.get("NODE_ENV") === "production") {
    logger.error("Refusing to seed a production database");
    await app.close();
    process.exit(1);
  }

  const passwords = app.get(PasswordService);
  const users = app.get<Model<UserDocument>>(getModelToken(User.name));
  const gyms = app.get<Model<GymDocument>>(getModelToken(Gym.name));
  const plans = app.get<Model<PlanDocument>>(getModelToken(Plan.name));
  const subscriptions = app.get<Model<SubscriptionDocument>>(
    getModelToken(Subscription.name),
  );
  const transactions = app.get<Model<TransactionDocument>>(
    getModelToken(Transaction.name),
  );

  const feeRate = config.getOrThrow<number>("PLATFORM_FEE_RATE");
  const hash = await passwords.hash(DEMO_PASSWORD);

  // Clear the previous demo, leaving anything else alone.
  const existing = await gyms.findOne({ slug: "ironcore-gym-lekki" });
  if (existing) {
    await Promise.all([
      users.deleteMany({ gymId: existing._id }),
      plans.deleteMany({ gymId: existing._id }),
      subscriptions.deleteMany({ gymId: existing._id }),
      transactions.deleteMany({ gymId: existing._id }),
    ]);
    await gyms.deleteOne({ _id: existing._id });
    await users.deleteMany({ phone: { $in: MEMBERS.map((row) => row.phone) } });
  }

  const owner = await users.create({
    name: "Ada Danjuma",
    phone: "08010001111",
    role: "owner",
    passwordHash: hash,
  });

  const gym = await gyms.create({
    name: "IronCore Gym",
    branch: "Lekki",
    area: "Lekki Phase 1",
    slug: "ironcore-gym-lekki",
    dayPassPrice: 2000,
    ownerId: owner._id,
    status: "active",
    listing: {
      planId: "pro",
      planName: "Pro",
      price: 35000,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 22 * 86_400_000),
    },
    settlementAccount: {
      bankCode: "058",
      bankName: "Guaranty Trust Bank",
      accountNumber: "0123454471",
      accountName: "IRONCORE FITNESS LTD",
      subaccountCode: "ACCT_mock_seed",
      recipientCode: "RCP_mock_seed",
      verifiedAt: new Date(),
    },
  });

  owner.gymId = gym._id;
  await owner.save();

  await users.create([
    {
      name: "Ngozi Eze",
      phone: "08020002222",
      role: "manager",
      gymId: gym._id,
      passwordHash: hash,
    },
    {
      name: "Musa Bello",
      phone: "08030003333",
      role: "scanner",
      gymId: gym._id,
      passwordHash: hash,
    },
  ]);

  const created = await plans.insertMany([
    {
      gymId: gym._id,
      name: "Monthly",
      price: 15000,
      durationDays: 30,
      perks: "Full gym access + 2 trainer sessions",
      popular: true,
    },
    {
      gymId: gym._id,
      name: "Quarterly",
      price: 40000,
      durationDays: 90,
      perks: "Full gym access + 6 trainer sessions",
    },
    {
      gymId: gym._id,
      name: "Annual",
      price: 140000,
      durationDays: 365,
      perks: "Full gym access + unlimited trainer sessions",
    },
  ]);

  const planByName = new Map(created.map((plan) => [plan.name, plan]));

  const memberDocs: UserDocument[] = [];

  for (const row of MEMBERS) {
    const member = await users.create({
      name: row.name,
      phone: row.phone,
      role: "member",
      passwordHash: hash,
    });
    memberDocs.push(member);

    const plan = planByName.get(row.plan)!;

    await subscriptions.create({
      memberId: member._id,
      gymId: gym._id,
      plan: {
        planId: plan._id,
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
      },
      status: row.daysLeft > 0 ? "active" : "expired",
      startedAt: new Date(Date.now() - 20 * 86_400_000),
      expiresAt: new Date(Date.now() + row.daysLeft * 86_400_000),
      qrToken: accessToken("MBR"),
    });
  }

  const ledger = PAYMENT_DAYS.map((entry) => {
    const member = memberDocs[entry.member]!;
    const source = MEMBERS[entry.member]!;
    const gross =
      entry.kind === "day_pass"
        ? gym.dayPassPrice
        : (planByName.get(source.plan)?.price ?? 15000);

    const split = splitOf(gross, feeRate);
    const paidAt = new Date(Date.now() - entry.daysAgo * 86_400_000);
    // Anything older than a day has been paid out, matching the sweep rule.
    const settled = entry.daysAgo >= 1;

    return {
      reference: paymentReference(entry.kind === "day_pass" ? "PASS" : "SUB"),
      provider: "mock",
      purpose: entry.kind,
      gymId: gym._id,
      payerId: member._id,
      payerName: member.name,
      ...split,
      currency: "NGN",
      channel: (["card", "transfer", "opay"] as const)[entry.daysAgo % 3],
      status: "success",
      settlementStatus: settled ? "settled" : "pending",
      settledAt: settled ? new Date(paidAt.getTime() + 86_400_000) : undefined,
      paidAt,
      metadata: {},
    };
  });

  await transactions.insertMany(ledger);

  logger.log(`Seeded ${gym.name} — ${gym.branch}`);
  logger.log(`Owner:   0801 000 1111 / ${DEMO_PASSWORD}`);
  logger.log(`Manager: 0802 000 2222 / ${DEMO_PASSWORD}`);
  logger.log(`Scanner: 0803 000 3333 / ${DEMO_PASSWORD}`);
  logger.log(`Member:  0803 214 7765 / ${DEMO_PASSWORD}`);

  await app.close();
}

void seed().catch((error: unknown) => {
  new Logger("Seed").error("Seeding failed", String(error));
  process.exit(1);
});
