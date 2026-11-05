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
  status: string;
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
type UrlResult = { url: string | null; error: string | null };

type SubscriptionRow = {
  billing_cycle: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  created_at: string;
  status: string;
};

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
  createCheckoutSession: (cycle: PlanCycle) => Promise<UrlResult>;
  createBillingPortalSession: () => Promise<UrlResult>;
  refreshSubscription: () => Promise<boolean>;
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const GUEST_SESSION_KEY = "autolog-session-v2";

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

function subscriptionFromRow(row: SubscriptionRow | null): Subscription | null {
  if (!row || (row.billing_cycle !== "monthly" && row.billing_cycle !== "yearly")) return null;
  return {
    cycle: row.billing_cycle,
    autoRenew: !row.cancel_at_period_end,
    startedAt: row.created_at.slice(0, 10),
    currentPeriodEnd: row.current_period_end?.slice(0, 10) ?? "",
    status: row.status,
  };
}

function hasActiveSubscription(subscription: Subscription | null): boolean {
  if (!subscription || !["active", "trialing", "past_due"].includes(subscription.status)) return false;
  return Boolean(subscription.currentPeriodEnd && new Date(`${subscription.currentPeriodEnd}T23:59:59`).getTime() >= Date.now());
}

function accountFromAuthUser(
  authUser: User,
  subscription: Subscription | null,
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
    plan: lifetimePremium || hasActiveSubscription(subscription) ? "premium" : "free",
    subscription,
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

async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const response = (error as { context?: unknown } | null)?.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json() as { error?: unknown };
      if (typeof body.error === "string") return body.error;
    } catch {
      // Use the fallback below when the function didn't return JSON.
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription | null>>({});
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

  const refreshSubscription = useCallback(async (): Promise<boolean> => {
    if (!authUser) return false;
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("billing_cycle,cancel_at_period_end,current_period_end,created_at,status")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (error) {
      console.error("Unable to load subscription status", error);
      return false;
    }
    const subscription = subscriptionFromRow(data as SubscriptionRow | null);
    setSubscriptions((current) => ({ ...current, [authUser.id]: subscription }));
    return hasActiveSubscription(subscription);
  }, [authUser]);

  useEffect(() => {
    if (authUser) void refreshSubscription();
  }, [authUser?.id, refreshSubscription]);

  useEffect(() => {
    if (!authUser) return;
    const onFocus = () => { void refreshSubscription(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [authUser?.id, refreshSubscription]);

  const subscription = authUser ? subscriptions[authUser.id] ?? null : null;
  const lifetimePremium = authUser
    ? lifetimeEntitlements[authUser.id] === true
    : false;
  const user = useMemo(
    () => authUser ? accountFromAuthUser(authUser, subscription, lifetimePremium) : null,
    [authUser, subscription, lifetimePremium],
  );
  const status: AuthStatus = !ready
    ? "loading"
    : authUser
      ? "authed"
      : guest
        ? "guest"
        : "anon";
  const isPremium = lifetimePremium || hasActiveSubscription(subscription);

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

  const createCheckoutSession = useCallback(async (cycle: PlanCycle): Promise<UrlResult> => {
    if (!authUser) return { url: null, error: "Sign in to subscribe to AutoLog Premium." };
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { cycle },
      });
      if (error) {
        return { url: null, error: await edgeFunctionErrorMessage(error, "Couldn't start secure checkout.") };
      }
      if (typeof data?.url !== "string") {
        return { url: null, error: data?.error ?? "Stripe didn't return a checkout link. Please try again." };
      }
      return { url: data.url, error: null };
    } catch {
      return { url: null, error: "Couldn't connect to secure checkout. Check your connection and try again." };
    }
  }, [authUser]);

  const createBillingPortalSession = useCallback(async (): Promise<UrlResult> => {
    if (!authUser) return { url: null, error: "Sign in to manage your subscription." };
    try {
      const { data, error } = await supabase.functions.invoke("create-billing-portal-session");
      if (error) {
        return { url: null, error: await edgeFunctionErrorMessage(error, "Couldn't open billing management.") };
      }
      if (typeof data?.url !== "string") {
        return { url: null, error: data?.error ?? "Stripe didn't return a billing link. Please try again." };
      }
      return { url: data.url, error: null };
    } catch {
      return { url: null, error: "Couldn't connect to billing management. Check your connection and try again." };
    }
  }, [authUser]);

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
    createCheckoutSession,
    createBillingPortalSession,
    refreshSubscription,
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
