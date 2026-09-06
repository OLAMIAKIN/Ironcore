import { SetMetadata } from "@nestjs/common";
import type { Role } from "@/common/types";

export const ROLES = "auth:roles";

/** Restricts a route to the listed roles. Applied on top of the JWT guard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
