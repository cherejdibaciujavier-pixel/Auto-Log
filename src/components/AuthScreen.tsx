/* ------------------------------------------------------------------ */
/*  AutoLog — sign in / create account / guest entry screen.           */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Eye,
  EyeOff,
  FileDown,
  Gauge,
  Lock,
  Mail,
  User,
  Wrench,
} from "lucide-react";
import { useAuth } from "../store/AuthContext";
import { inputCls } from "./ui";
import { cn } from "../utils/cn";

export default function AuthScreen() {
  const { signIn, signUp, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = mode === "signup"
        ? await signUp(name, email, password)
        : await signIn(email, password);
      setError(result.error);
      setNotice(result.message ?? null);
    } catch {
      setError("Couldn't connect right now. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* soft ambient background */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#0071e3]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-80 w-80 rounded-full bg-[#30b0c7]/15 blur-3xl" />

      <div className="animate-fade-up relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#0071e3] text-white shadow-[0_10px_24px_rgba(0,113,227,0.35)]">
            <Gauge size={28} strokeWidth={2.2} />
          </span>
          <h1 className="mt-4 text-[26px] font-bold tracking-tight text-neutral-900">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            {mode === "signup"
              ? "Create a secure AutoLog account with your email."
              : "Sign in to open your AutoLog account."}
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-[0_16px_44px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
          {/* mode switch */}
          <div className="mb-5 flex rounded-full bg-[#f5f5f7] p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={cn(
                  "flex-1 rounded-full py-2 text-[13.5px] font-semibold transition",
                  mode === m
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500",
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  className={cn(inputCls, "pl-10")}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                className={cn(inputCls, "pl-10")}
                placeholder="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                className={cn(inputCls, "pl-10 pr-11")}
                placeholder="Password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p role="alert" className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600">
                <AlertCircle size={15} className="shrink-0" /> {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[13px] font-medium text-emerald-700">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[#0071e3] py-3 text-[15px] font-semibold text-white transition hover:bg-[#0077ed] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-neutral-300">
            <span className="h-px flex-1 bg-neutral-100" /> or{" "}
            <span className="h-px flex-1 bg-neutral-100" />
          </div>
          <button
            onClick={continueAsGuest}
            className="w-full rounded-full bg-[#f5f5f7] py-3 text-[14.5px] font-semibold text-neutral-700 transition hover:bg-neutral-100"
          >
            Continue as guest
          </button>
          <p className="mt-3 text-center text-[11.5px] leading-relaxed text-neutral-400">
            Your signed-in garage syncs to your account. Guest data is temporary
            and will be cleared when you leave this session.
          </p>
        </div>

        {/* value props */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: <Wrench size={16} />, label: "Service predictor" },
            { icon: <CalendarClock size={16} />, label: "Expiry alerts" },
            { icon: <FileDown size={16} />, label: "PDF reports" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/70 px-2 py-3 ring-1 ring-black/[0.03] backdrop-blur"
            >
              <span className="text-[#0071e3]">{f.icon}</span>
              <span className="text-[11px] font-medium text-neutral-500">
                {f.label}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
