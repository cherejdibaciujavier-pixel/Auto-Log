/* ------------------------------------------------------------------ */
/*  AutoLog — Supabase authentication and account state.                */
/*                                                                     */
/*  Credentials and sessions are handled by Supabase Auth. Signed-in   */
/*  vehicle data is synced to the Supabase database.                    */
/* ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { todayISO } from "../lib/utils";
import { supabase } from "../lib/supabase";

export type PlanCycle = "monthly" | "yearly";

export interface Subscription {
  cycle: PlanCycle;
  autoRenew: boolean;
  startedAt: string;
  currentPeriodEnd: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  plan: "free" | "premium";
  subscription: Subscription | null;
  lifetimePremium: boolean;
}

export const PLAN_PRICES: Record<PlanCycle, { total: number; perMonth: number }> = {
  monthly: { total: 4.99, perMonth: 4.99 },
  yearly: { total: 39.99, perMonth: 3.33 },
};

export const FREE_VEHICLE_LIMIT = 1;

type AuthStatus = "loading" | "anon" | "guest" | "authed";
type AuthResult = { error: string | null; message?: string };

interface LocalAccountState {
  plan: "free" | "premium";
  subscription: Subscription | null;
}

interface AuthContextValue {
  status: AuthStatus;
  user: UserAccount | null;
  isPremium: boolean;
  lifetimePremium: boolean;
  redeemLifetimeCode: (code: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  exitToAuth: () => void;
  updateProfile: (name: string) => Promise<string | null>;
  changePassword: (current: string, next: string) => Promise<string | null>;
  subscribe: (cycle: PlanCycle) => void;
  setAutoRenew: (on: boolean) => void;
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const GUEST_SESSION_KEY = "autolog-session-v2";
const ACCOUNT_STATE_PREFIX = "autolog-account-v1:";

function loadGuestSession(): boolean {
  try {
    const session = JSON.parse(localStorage.getItem(GUEST_SESSION_KEY) ?? "null");
    return session?.mode === "guest";
  } catch {
    return false;
  }
}

function saveGuestSession(active: boolean) {
  try {
    if (active) localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify({ mode: "guest" }));
    else localStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    // The browser can still use the app for the current session.
  }
}

function accountStateKey(userId: string) {
  return `${ACCOUNT_STATE_PREFIX}${userId}`;
}

function readAccountState(userId: string): LocalAccountState {
  try {
    const raw = localStorage.getItem(accountStateKey(userId));
    if (raw) return JSON.parse(raw) as LocalAccountState;
  } catch {
    // Ignore stale or malformed local account preferences.
  }
  return { plan: "free", subscription: null };
}

function persistAccountState(userId: string, state: LocalAccountState) {
  try {
    localStorage.setItem(accountStateKey(userId), JSON.stringify(state));
  } catch {
    // Account authentication is independent of optional local preferences.
  }
}

function addMonthsISO(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1 + months, day);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function accountFromAuthUser(
  authUser: User,
  localState: LocalAccountState,
  lifetimePremium: boolean,
): UserAccount {
  const metadataName = authUser.user_metadata?.full_name;
  const email = authUser.email ?? "";
  return {
    id: authUser.id,
    name: typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : email.split("@")[0] || "AutoLog driver",
    email,
    createdAt: authUser.created_at?.slice(0, 10) ?? todayISO(),
    plan: localState.plan,
    subscription: localState.subscription,
    lifetimePremium,
  };
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/user already registered/i.test(message)) return "An account with this email already exists. Try signing in.";
  if (/password should be at least/i.test(message)) return "Password must be at least 6 characters.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
  if (/^(?:typeerror:\s*)?(?:load failed|failed to fetch|networkerror|network request failed)$/i.test(message.trim())) {
    return "Couldn't reach AutoLog sign-in. Check your connection, then try again. If it continues, temporarily turn off a VPN or content blocker and retry.";
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);
  const [accountStates, setAccountStates] = useState<Record<string, LocalAccountState>>({});
  const [lifetimeEntitlements, setLifetimeEntitlements] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      setAuthUser(nextUser);
      if (nextUser) {
        setGuest(false);
        saveGuestSession(false);
        setAccountStates((states) => ({
          ...states,
          [nextUser.id]: states[nextUser.id] ?? readAccountState(nextUser.id),
        }));
      }
      setReady(true);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Unable to restore Supabase session", error);
      const nextUser = data.session?.user ?? null;
      setAuthUser(nextUser);
      if (nextUser) {
        setGuest(false);
        saveGuestSession(false);
        setAccountStates((states) => ({
          ...states,
          [nextUser.id]: states[nextUser.id] ?? readAccountState(nextUser.id),
        }));
      } else {
        setGuest(loadGuestSession());
      }
      setReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = authUser?.id;
    if (!userId) return;
    let active = true;
    void supabase
      .from("user_entitlements")
      .select("lifetime_premium")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to load account entitlements", error);
          return;
        }
        setLifetimeEntitlements((entitlements) => ({
          ...entitlements,
          [userId]: entitlements[userId] === true || data?.lifetime_premium === true,
        }));
      });
    return () => { active = false; };
  }, [authUser?.id]);

  const localState = authUser
    ? accountStates[authUser.id] ?? readAccountState(authUser.id)
    : { plan: "free" as const, subscription: null };
  const lifetimePremium = authUser
    ? lifetimeEntitlements[authUser.id] === true
    : false;
  const user = useMemo(
    () => authUser ? accountFromAuthUser(authUser, localState, lifetimePremium) : null,
    [authUser, localState, lifetimePremium],
  );
  const status: AuthStatus = !ready
    ? "loading"
    : authUser
      ? "authed"
      : guest
        ? "guest"
        : "anon";
  const isPremium = user?.plan === "premium" || lifetimePremium;

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<AuthResult> => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName) return { error: "Please enter your name." };
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return { error: "Enter a valid email address." };
    if (password.length < 6) return { error: "Password must be at least 6 characters." };

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: cleanName },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) return { error: friendlyAuthError(error.message) };
    if (!data.session) {
      return {
        error: null,
        message: "Your account was created. Check your email to confirm it, then sign in.",
      };
    }
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return { error: "Enter a valid email address." };
    if (!password) return { error: "Enter your password." };
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    return { error: error ? friendlyAuthError(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    saveGuestSession(false);
    setGuest(false);
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Unable to sign out", error);
  }, []);

  const continueAsGuest = useCallback(() => {
    saveGuestSession(true);
    setGuest(true);
  }, []);

  const exitToAuth = useCallback(() => {
    saveGuestSession(false);
    setGuest(false);
  }, []);

  const updateProfile = useCallback(async (name: string): Promise<string | null> => {
    const cleanName = name.trim();
    if (!authUser) return "Not signed in.";
    if (!cleanName) return "Please enter your name.";
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: cleanName } });
    if (error) return friendlyAuthError(error.message);
    if (data.user) setAuthUser(data.user);
    return null;
  }, [authUser]);

  const changePassword = useCallback(async (current: string, next: string): Promise<string | null> => {
    if (!authUser?.email) return "Not signed in.";
    if (next.length < 6) return "New password must be at least 6 characters.";
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: current,
    });
    if (verifyError) return "Current password is incorrect.";
    const { error } = await supabase.auth.updateUser({ password: next });
    return error ? friendlyAuthError(error.message) : null;
  }, [authUser]);

  const updateLocalAccount = useCallback((userId: string, next: LocalAccountState) => {
    persistAccountState(userId, next);
    setAccountStates((states) => ({ ...states, [userId]: next }));
  }, []);

  const subscribe = useCallback((cycle: PlanCycle) => {
    if (!authUser) return;
    const existing = accountStates[authUser.id] ?? readAccountState(authUser.id);
    const today = todayISO();
    updateLocalAccount(authUser.id, {
      plan: "premium",
      subscription: {
        cycle,
        autoRenew: true,
        startedAt: existing.subscription?.startedAt ?? today,
        currentPeriodEnd: addMonthsISO(today, cycle === "monthly" ? 1 : 12),
      },
    });
  }, [accountStates, authUser, updateLocalAccount]);

  const setAutoRenew = useCallback((on: boolean) => {
    if (!authUser) return;
    const existing = accountStates[authUser.id] ?? readAccountState(authUser.id);
    if (!existing.subscription) return;
    const subscription = { ...existing.subscription, autoRenew: on };
    if (!on && subscription.currentPeriodEnd < todayISO()) {
      updateLocalAccount(authUser.id, { plan: "free", subscription: null });
      return;
    }
    updateLocalAccount(authUser.id, { ...existing, subscription });
  }, [accountStates, authUser, updateLocalAccount]);

  const redeemLifetimeCode = useCallback(async (code: string): Promise<string | null> => {
    if (!authUser) return "Sign in to redeem a Premium code.";
    const cleanCode = code.trim();
    if (!cleanCode) return "Enter your Premium code.";

    const { data, error } = await supabase.functions.invoke("redeem-lifetime-premium", {
      body: { code: cleanCode },
    });
    if (error) {
      const response = (error as { context?: unknown }).context;
      if (response instanceof Response) {
        try {
          const body = await response.clone().json() as { error?: unknown };
          if (typeof body.error === "string") return body.error;
        } catch {
          // Fall through to the generic network error.
        }
      }
      return data?.error ?? "Couldn't redeem that code. Please try again.";
    }
    if (data?.success !== true) return data?.error ?? "That code couldn't be redeemed.";

    setLifetimeEntitlements((entitlements) => ({
      ...entitlements,
      [authUser.id]: true,
    }));
    return null;
  }, [authUser]);

  const deleteAccount = useCallback(async (): Promise<string | null> => {
    if (!authUser) return "Not signed in.";
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) return `Account deletion failed: ${error.message}`;
    try {
      localStorage.removeItem(`autolog-db-v2:${authUser.id}`);
      localStorage.removeItem(accountStateKey(authUser.id));
    } catch {
      // The account is already deleted; local cleanup is best effort.
    }
    await supabase.auth.signOut();
    return null;
  }, [authUser]);

  const value: AuthContextValue = {
    status,
    user,
    isPremium,
    lifetimePremium,
    redeemLifetimeCode,
    signUp,
    signIn,
    signOut,
    continueAsGuest,
    exitToAuth,
    updateProfile,
    changePassword,
    subscribe,
    setAutoRenew,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 80% 55%), hsl(${(h + 40) % 360} 85% 45%))`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const PREMIUM_FEATURES = [
  "Unlimited vehicles in your garage",
  "PDF resale history reports",
  "Full data backup & JSON export",
  "Early 90-day document expiry forecasts",
  "Priority email support",
];

export const FREE_FEATURES = [
  `${FREE_VEHICLE_LIMIT} vehicle`,
  "Unlimited service & fuel logs",
  "Document expiry reminders (30 days)",
  "Expense analytics dashboard",
];
