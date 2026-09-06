"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

/**
 * The signed-in user, mirrored from the API into a tiny store so the shell and
 * every screen see the same thing. There is no token here to leak: the session
 * is a pair of httpOnly cookies, and this is only a cache of who they belong to.
 */

export type Role = "member" | "owner" | "manager" | "scanner";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  /** Staff only — the gym they work at. */
  gymId?: string;
};

type State = {
  user: SessionUser | null;
  /** Null until the first /auth/me has come back. */
  status: "loading" | "ready";
};

let state: State = { user: null, status: "loading" };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function set(next: State): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATE: State = { user: null, status: "loading" };

/** Fetches the current user once; later calls share the same request. */
export function loadSession(force = false): Promise<void> {
  if (inFlight && !force) return inFlight;

  inFlight = api
    .get<{ user: SessionUser }>("/auth/me")
    .then((data) => set({ user: data.user, status: "ready" }))
    .catch(() => set({ user: null, status: "ready" }))
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function useSession(): State & { reload: () => Promise<void> } {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );

  useEffect(() => {
    if (state.status === "loading") void loadSession();
  }, []);

  const reload = useCallback(() => loadSession(true), []);

  return { ...snapshot, reload };
}

/* ------------------------------------------------------------------
   Sign-in, sign-up and sign-out
   ------------------------------------------------------------------ */

export async function signIn(phone: string, password: string): Promise<SessionUser> {
  const { user } = await api.post<{ user: SessionUser }>("/auth/login", {
    phone,
    password,
  });
  set({ user, status: "ready" });
  return user;
}

export async function signUpMember(input: {
  name: string;
  phone: string;
  password: string;
  email?: string;
}): Promise<SessionUser> {
  const { user } = await api.post<{ user: SessionUser }>(
    "/auth/register/member",
    input,
  );
  set({ user, status: "ready" });
  return user;
}

/**
 * Creates the owner and their gym together. The gym is a draft until the
 * listing payment clears, which is the last step of onboarding.
 */
export async function signUpGym(input: {
  ownerName: string;
  phone: string;
  password: string;
  gymName: string;
  branch: string;
  area: string;
  dayPassPrice: number;
  email?: string;
}): Promise<{ user: SessionUser; gymId: string }> {
  const result = await api.post<{ user: SessionUser; gymId: string }>(
    "/auth/register/gym",
    input,
  );
  set({ user: result.user, status: "ready" });
  return result;
}

export async function signOut(): Promise<void> {
  await api.post("/auth/logout").catch(() => undefined);
  set({ user: null, status: "ready" });
}

/* ------------------------------------------------------------------
   Convenience for screens that only make sense for one audience
   ------------------------------------------------------------------ */

export function useMemberSession(): SessionUser | null {
  const { user } = useSession();
  return user?.role === "member" ? user : null;
}

export function useStaffSession(): SessionUser | null {
  const { user } = useSession();
  return user && user.role !== "member" ? user : null;
}

export const ROLE_LABELS: Record<Role, string> = {
  member: "Member",
  owner: "Gym owner",
  manager: "Manager",
  scanner: "Front desk",
};
