import { z } from "zod";

/**
 * Every environment variable the API reads, validated once at boot. A missing
 * or malformed value kills the process here rather than surfacing as a strange
 * runtime error later.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  /** Atlas connection string. Never logged, never returned by an endpoint. */
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().default("ironcore"),

  /** Comma-separated list of browser origins allowed to send cookies. */
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be 32+ chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be 32+ chars"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  /** Cookies go `secure` off localhost; keep this false for http://localhost. */
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  COOKIE_DOMAIN: z.string().optional(),
  /**
   * Path the browser reaches the API under, when it is proxied rather than
   * called directly — "/api" for the Next.js rewrite. Cookie paths are matched
   * against the browser's URL, so the refresh cookie is scoped with this.
   */
  COOKIE_PATH_PREFIX: z.string().default(""),

  /** What IronCore keeps on each member payment, as a fraction. */
  PLATFORM_FEE_RATE: z.coerce.number().min(0).max(0.5).default(0.05),

  /**
   * What Paystack charges, so a payment can be grossed up to cover it and the
   * gym still receives the price it quoted. These are Paystack's published
   * Nigerian rates — confirm them against your own contract, because a
   * negotiated rate here means the gym is paid a naira or two short.
   */
  PAYSTACK_FEE_PERCENT: z.coerce.number().min(0).max(0.2).default(0.015),
  PAYSTACK_FEE_FLAT: z.coerce.number().int().min(0).default(100),
  PAYSTACK_FEE_FLAT_FROM: z.coerce.number().int().min(0).default(2500),
  PAYSTACK_FEE_CAP: z.coerce.number().int().min(0).default(2000),

  PAYMENTS_PROVIDER: z.enum(["mock", "paystack"]).default("mock"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_BASE_URL: z.string().url().default("https://api.paystack.co"),
  /** Where Paystack sends the payer back after a real checkout. */
  PAYMENT_CALLBACK_URL: z
    .string()
    .url()
    .default("http://localhost:3000/payments/callback"),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${problems}`);
  }

  const env = parsed.data;

  // The real provider is useless without a key; fail at boot, not mid-payment.
  if (env.PAYMENTS_PROVIDER === "paystack" && !env.PAYSTACK_SECRET_KEY) {
    throw new Error(
      "PAYMENTS_PROVIDER=paystack requires PAYSTACK_SECRET_KEY to be set",
    );
  }

  return env;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
