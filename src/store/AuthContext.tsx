/* ------------------------------------------------------------------ */
/*  AutoLog — account & subscription store (local, zero-backend).      */
/*                                                                     */
/*  Users, sessions and subscriptions live in localStorage so the      */
/*  whole flow works offline. Passwords are only lightly hashed —      */
/*  in production swap this provider for Supabase Auth / Firebase      */
/*  (the public interface below stays identical).                      */
/*                                                                     */
/*  Data isolation: each account gets its own vehicle database         */
/*  (see DataProvider `storageId`), guests get a shared "guest" one.   */
/* ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { todayISO, uid } from "../lib/utils";

export type PlanCycle = "monthly" | "yearly";

export interface Subscription {
  cycle: PlanCycle;
  autoRenew: boolean;
  startedAt: string;
  /** Premium stays active until this date (even after cancelling). */
  currentPeriodEnd: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  plan: "free" | "premium";
  subscription: Subscription | null;
}

export const PLAN_PRICES: Record<PlanCycle, { total: number; perMonth: number }> = {
  monthly: { total: 4.99, perMonth: 4.99 },
  yearly: { total: 39.99, perMonth: 3.33 },
};

/** Free-tier limits (Premium = unlimited). */
export const FREE_VEHICLE_LIMIT = 1;

const USERS_KEY = "autolog-users-v2";
const SESSION_KEY = "autolog-session-v2";

type AuthStatus = "anon" | "guest" | "authed";

interface Session {
  mode: "user" | "guest";
  userId?: string;
}

/* Demo-grade password hashing (NOT secure — replace with a real auth
   provider server-side hash in production). */
function hashPw(pw: string): string {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}`;
}

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Resolve time-based subscription state: simulate auto-renew charges
 * and expire cancelled plans whose paid period has ended.
 */
function resolveUser(u: UserAccount): UserAccount {
  if (u.plan !== "premium" || !u.subscription) return u;
  const today = todayISO();
  let { currentPeriodEnd } = u.subscription;
  if (currentPeriodEnd >= today) return u;
  if (!u.subscription.autoRenew) {
    return { ...u, plan: "free", subscription: null };
  }
  // Auto-renew: roll the period forward (mock charge) until current.
  let guard = 0;
  while (currentPeriodEnd < today && guard++ < 240) {
    currentPeriodEnd = addMonthsISO(
      currentPeriodEnd,
      u.subscription.cycle === "monthly" ? 1 : 12,
    );
  }
  return {
    ...u,
    subscription: { ...u.subscription, currentPeriodEnd },
  };
}

function loadUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = (JSON.parse(raw) as UserAccount[]).map(resolveUser);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as Session;
  } catch {
    /* ignore */
  }
  return null;
}

interface AuthContextValue {
  status: AuthStatus;
  user: UserAccount | null;
  isPremium: boolean;
  signUp: (name: string, email: string, password: string) => string | null;
  signIn: (email: string, password: string) => string | null;
  signOut: () => void;
  continueAsGuest: () => void;
  /** Leave guest mode and go back to the sign-in screen. */
  exitToAuth: () => void;
  updateProfile: (name: string) => void;
  changePassword: (current: string, next: string) => string | null;
  subscribe: (cycle: PlanCycle) => void;
  setAutoRenew: (on: boolean) => void;
  deleteAccount: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserAccount[]>(loadUsers);
  const [session, setSession] = useState<Session | null>(loadSession);

  const persistUsers = (next: UserAccount[]) => {
    setUsers(next);
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const persistSession = (next: Session | null) => {
    setSession(next);
    try {
      if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  const user = useMemo(() => {
    if (session?.mode !== "user" || !session.userId) return null;
    return users.find((u) => u.id === session.userId) ?? null;
  }, [session, users]);

  const status: AuthStatus =
    session?.mode === "user" && user
      ? "authed"
      : session?.mode === "guest"
        ? "guest"
        : "anon";

  const isPremium = user?.plan === "premium";

  const patchUser = useCallback(
    (id: string, patch: Partial<UserAccount>) => {
      setUsers((prev) => {
        const next = prev.map((u) => (u.id === id ? { ...u, ...patch } : u));
        try {
          localStorage.setItem(USERS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  /* ------------------------------ auth actions ------------------------------ */
  const signUp = useCallback(
    (name: string, email: string, password: string): string | null => {
      const cleanEmail = email.trim().toLowerCase();
      if (!name.trim()) return "Please enter your name.";
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return "Enter a valid email address.";
      if (password.length < 6) return "Password must be at least 6 characters.";
      if (users.some((u) => u.email === cleanEmail))
        return "An account with this email already exists.";
      const account: UserAccount = {
        id: uid(),
        name: name.trim(),
        email: cleanEmail,
        passwordHash: hashPw(password),
        createdAt: todayISO(),
        plan: "free",
        subscription: null,
      };
      persistUsers([...users, account]);
      persistSession({ mode: "user", userId: account.id });
      return null;
    },
    [users],
  );

  const signIn = useCallback(
    (email: string, password: string): string | null => {
      const cleanEmail = email.trim().toLowerCase();
      const found = users.find((u) => u.email === cleanEmail);
      if (!found || found.passwordHash !== hashPw(password))
        return "Incorrect email or password.";
      persistSession({ mode: "user", userId: found.id });
      return null;
    },
    [users],
  );

  const signOut = useCallback(() => persistSession(null), []);
  const continueAsGuest = useCallback(
    () => persistSession({ mode: "guest" }),
    [],
  );
  const exitToAuth = useCallback(() => persistSession(null), []);

  /* ---------------------------- account actions ---------------------------- */
  const updateProfile = useCallback(
    (name: string) => {
      if (user && name.trim()) patchUser(user.id, { name: name.trim() });
    },
    [user, patchUser],
  );

  const changePassword = useCallback(
    (current: string, next: string): string | null => {
      if (!user) return "Not signed in.";
      if (user.passwordHash !== hashPw(current))
        return "Current password is incorrect.";
      if (next.length < 6) return "New password must be at least 6 characters.";
      patchUser(user.id, { passwordHash: hashPw(next) });
      return null;
    },
    [user, patchUser],
  );

  const deleteAccount = useCallback(() => {
    if (!user) return;
    persistUsers(users.filter((u) => u.id !== user.id));
    try {
      localStorage.removeItem(`autolog-db-v2:${user.id}`);
    } catch {
      /* ignore */
    }
    persistSession(null);
  }, [user, users]);

  /* -------------------------- subscription actions -------------------------- */
  const subscribe = useCallback(
    (cycle: PlanCycle) => {
      if (!user) return;
      const today = todayISO();
      patchUser(user.id, {
        plan: "premium",
        subscription: {
          cycle,
          autoRenew: true,
          startedAt: user.subscription?.startedAt ?? today,
          currentPeriodEnd: addMonthsISO(today, cycle === "monthly" ? 1 : 12),
        },
      });
    },
    [user, patchUser],
  );

  const setAutoRenew = useCallback(
    (on: boolean) => {
      if (!user?.subscription) return;
      patchUser(user.id, {
        subscription: { ...user.subscription, autoRenew: on },
      });
    },
    [user, patchUser],
  );

  const value: AuthContextValue = {
    status,
    user,
    isPremium,
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

/** Avatar initials + a stable gradient hue per user. */
export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 80% 55%), hsl(${(h + 40) % 360} 85% 45%))`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** First expiry warning horizon copy (used by pricing screen). */
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
