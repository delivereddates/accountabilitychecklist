"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Zap } from "lucide-react";
import {
  isIOS,
  isStandalone,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

export function PushSettings({
  subscriptionCount,
  onChanged,
}: {
  subscriptionCount: number;
  onChanged: () => Promise<void>;
}) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
    setIosNeedsInstall(isIOS() && !isStandalone());
  }, []);

  async function handleSubscribe() {
    setBusy(true);
    setMessage(null);
    try {
      await subscribeToPush();
      setPermission("granted");
      await onChanged();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Couldn't enable notifications on this device.",
      );
      if (typeof Notification !== "undefined") {
        setPermission(Notification.permission);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setBusy(true);
    setMessage(null);
    try {
      await unsubscribeFromPush();
      await onChanged();
    } catch {
      setMessage("Couldn't disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data?.error || "Couldn't send the test notification.");
    } else if (data.sent === 0) {
      setMessage("Sent — but no devices are subscribed on your account.");
    } else {
      setMessage("Test sent — check your notifications.");
    }
  }

  const subscribed = subscriptionCount > 0;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <h2 className="text-base font-semibold">This device</h2>
      <p className="mb-3 text-sm text-[var(--muted)]">
        {subscribed
          ? `Notifications are on for this account (${subscriptionCount} device${subscriptionCount === 1 ? "" : "s"} subscribed).`
          : "Enable notifications so your reminders actually arrive."}
      </p>

      {iosNeedsInstall && (
        <p className="mb-3 rounded-lg border border-[var(--color-exempt-soft)] bg-[var(--color-exempt-soft)] px-3 py-2 text-sm">
          On iPhone/iPad, notifications only work for installed apps: tap Share
          → <strong>Add to Home Screen</strong>, open the app from that icon,
          then come back here and enable notifications.
        </p>
      )}

      {permission === "denied" && (
        <p className="mb-3 rounded-lg border border-[var(--color-nocheck-soft)] bg-[var(--color-nocheck-soft)] px-3 py-2 text-sm text-[var(--color-nocheck)]">
          Notifications are blocked for this site — allow them in your browser
          settings, then return here.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!subscribed ? (
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-check)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <BellRing className="h-4 w-4" />
            {busy ? "Working…" : "Enable notifications"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleTest}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-check)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Zap className="h-4 w-4" /> Send test
            </button>
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50"
            >
              <BellOff className="h-4 w-4" /> Disable
            </button>
          </>
        )}
      </div>

      {message && <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>}
    </section>
  );
}
