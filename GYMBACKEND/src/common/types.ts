/** Everything the API knows about the caller once a token has been verified. */
export type Role = "member" | "owner" | "manager" | "scanner";

export const STAFF_ROLES: Role[] = ["owner", "manager", "scanner"];

export type AuthUser = {
  id: string;
  role: Role;
  /** Staff belong to exactly one gym; members belong to none. */
  gymId?: string;
  /** Bumped on password change so old access tokens stop working. */
  tokenVersion: number;
};

declare module "express" {
  interface Request {
    user?: AuthUser;
  }
}
