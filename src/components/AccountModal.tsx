/* ------------------------------------------------------------------ */
/*  AutoLog — account centre: profile, plan summary, security and      */
/*  danger-zone actions. Guests get a conversion view instead.         */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import {
  Crown,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { avatarGradient, initialsOf, useAuth } from "../store/AuthContext";
import { useData } from "../store/DataContext";
import { fmtDate } from "../lib/utils";
import { ConfirmDialog, Field, Modal, inputCls } from "./ui";
import { cn } from "../utils/cn";

export default function AccountModal() {
  const { closeModal, openModal, notify } = useData();
  const {
    status,
    user,
    isPremium,
    signOut,
    exitToAuth,
    updateProfile,
    changePassword,
    deleteAccount,
  } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ------------------------------ guest view ------------------------------ */
  if (status === "guest" || !user) {
    return (
      <Modal open onClose={closeModal} title="Your account">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <UserRound size={28} />
          </span>
          <h3 className="mt-3 text-[17px] font-bold text-neutral-900">
            You're browsing as a guest
          </h3>
          <p className="mx-auto mt-1 max-w-xs text-[13.5px] leading-relaxed text-neutral-500">
            Guest mode is temporary and doesn't save vehicle data. Sign in or
            create an account to start a garage that syncs to the cloud.
          </p>
          <button
            onClick={() => {
              closeModal();
              exitToAuth();
            }}
            className="mt-5 w-full rounded-full bg-[#0071e3] py-3 text-[15px] font-semibold text-white transition hover:bg-[#0077ed]"
          >
            Sign in / Create account
          </button>
          <button
            onClick={closeModal}
            className="mt-2 w-full py-2 text-[13.5px] font-medium text-neutral-500"
          >
            Keep browsing as guest
          </button>
        </div>
      </Modal>
    );
  }

  const sub = user.subscription;

  return (
    <>
      <Modal open onClose={closeModal} title="Account">
        {/* ------------------------------- profile ------------------------------- */}
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-white shadow-inner"
            style={{ background: avatarGradient(user.email) }}
          >
            {initialsOf(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold text-neutral-900">
              {user.name}
            </p>
            <p className="truncate text-[13px] text-neutral-400">{user.email}</p>
            <p className="text-[12px] text-neutral-400">
              Member since {fmtDate(user.createdAt)}
            </p>
          </div>
        </div>

        {/* -------------------------------- plan -------------------------------- */}
        <button
          onClick={() => openModal("pricing")}
          className={cn(
            "mt-5 flex w-full items-center gap-3 rounded-[20px] p-4 text-left transition",
            isPremium
              ? "bg-gradient-to-br from-[#0071e3] to-[#42a5f5] text-white"
              : "bg-[#f5f5f7] text-neutral-800 hover:bg-neutral-100",
          )}
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isPremium ? "bg-white/20 text-white" : "bg-white text-[#0071e3] shadow-sm",
            )}
          >
            <Crown size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">
              {user.lifetimePremium ? "AutoLog Premium · Lifetime" : isPremium ? "AutoLog Premium" : "AutoLog Free"}
            </span>
            <span
              className={cn(
                "block truncate text-[12.5px]",
                isPremium ? "text-white/85" : "text-neutral-400",
              )}
            >
              {user.lifetimePremium
                ? "Lifetime access · available on all your devices"
                : isPremium && sub
                  ? sub.autoRenew
                    ? `Renews ${fmtDate(sub.currentPeriodEnd)} · ${sub.cycle}`
                    : `Ends ${fmtDate(sub.currentPeriodEnd)} · ${sub.cycle}`
                  : "1 vehicle · PDF reports locked"}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold",
              isPremium
                ? "bg-white text-[#0071e3]"
                : "bg-[#0071e3] text-white",
            )}
          >
            {user.lifetimePremium ? "Active" : isPremium ? "Manage" : "Upgrade"}
          </span>
        </button>

        {isPremium && (
          <a
            href={`mailto:cherejdibaciujavier@gmail.com?subject=${encodeURIComponent("AutoLog Premium priority support")}&body=${encodeURIComponent(`Hello AutoLog support,\n\nAccount: ${user.email}\nName: ${user.name}\n\nHow can we help?\n`)}`}
            className="mt-3 flex items-center gap-3 rounded-[20px] bg-blue-50 p-4 text-left text-[#0071e3] transition hover:bg-blue-100"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
              <Mail size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold">Priority email support</span>
              <span className="block text-[12px] text-blue-700/75">Contact the AutoLog support team</span>
            </span>
          </a>
        )}

        {/* ----------------------------- edit profile ----------------------------- */}
        <div className="mt-6 space-y-4">
          <Field label="Display name">
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <button
                disabled={savingProfile || name.trim() === user.name || !name.trim()}
                onClick={async () => {
                  setSavingProfile(true);
                  setProfileError(null);
                  try {
                    const error = await updateProfile(name);
                    if (error) setProfileError(error);
                    else notify("Profile updated");
                  } catch {
                    setProfileError("Couldn't save your profile. Check your connection and try again.");
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                className="shrink-0 rounded-xl bg-neutral-900 px-4 text-[13.5px] font-semibold text-white transition disabled:opacity-30"
              >
                Save
              </button>
            </div>
            {profileError && <p role="alert" className="mt-2 text-[12.5px] text-red-500">{profileError}</p>}
          </Field>

          <Field label="Change password">
            <div className="space-y-2">
              <input
                className={inputCls}
                type="password"
                placeholder="Current password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  type="password"
                  placeholder="New password (6+ characters)"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  disabled={savingPassword || !currentPw || !newPw}
                  onClick={async () => {
                    setSavingPassword(true);
                    try {
                      const error = await changePassword(currentPw, newPw);
                      if (error) {
                        setPwMsg({ ok: false, text: error });
                      } else {
                        setPwMsg({ ok: true, text: "Password changed." });
                        setCurrentPw("");
                        setNewPw("");
                      }
                    } catch {
                      setPwMsg({ ok: false, text: "Couldn't update your password. Check your connection and try again." });
                    } finally {
                      setSavingPassword(false);
                    }
                  }}
                  className="shrink-0 rounded-xl bg-neutral-900 px-4 text-[13.5px] font-semibold text-white transition disabled:opacity-30"
                >
                  {savingPassword ? "Updating…" : "Update"}
                </button>
              </div>
              {pwMsg && (
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-[12.5px] font-medium",
                    pwMsg.ok ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  <ShieldCheck size={13} /> {pwMsg.text}
                </p>
              )}
            </div>
          </Field>
        </div>

        {/* ------------------------------- actions ------------------------------- */}
        <div className="mt-6 space-y-2">
          <button
            onClick={() => {
              closeModal();
              signOut();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#f5f5f7] py-3 text-[14.5px] font-semibold text-neutral-700 transition hover:bg-neutral-100"
          >
            <LogOut size={16} /> Sign out
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-red-50 py-3 text-[14.5px] font-semibold text-red-600 transition hover:bg-red-100"
          >
            <Trash2 size={16} /> Delete account
          </button>
          {deleteError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12.5px] text-red-600">{deleteError}</p>}
          <p className="pt-1 text-center text-[11.5px] leading-relaxed text-neutral-400">
            Deleting permanently removes your AutoLog account and its cloud
            garage. Cars, logs and documents cannot be recovered.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account?"
        message="Your Supabase login and its cloud vehicle data will be permanently erased. This cannot be undone."
        confirmLabel="Delete account"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          setDeleteError(null);
          void deleteAccount()
            .then((error) => {
              if (error) setDeleteError(error);
              else closeModal();
            })
            .catch(() => setDeleteError("Couldn't delete your account. Check your connection and try again."));
        }}
      />
    </>
  );
}
