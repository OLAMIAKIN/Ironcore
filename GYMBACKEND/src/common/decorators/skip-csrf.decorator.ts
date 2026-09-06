import { SetMetadata } from "@nestjs/common";

export const SKIP_CSRF = "csrf:skip";

/**
 * For endpoints a browser never posts to — gateway webhooks, which carry their
 * own signature instead.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);
