"use client";

/**
 * Browser-side Web Push helpers. `subscribeToPush` must be called from a
 * click handler — iOS only shows the permission prompt inside a user gesture
 * (and only when the app is installed to the home screen).
 */

export function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribeToPush(): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push is not configured on the server.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications weren't allowed.");
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const j = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }),
  });
  if (!res.ok) {
    await sub.unsubscribe();
    throw new Error("Couldn't save the subscription.");
  }
}

/** Unsubscribe this device AND remove every server-side subscription row on
 * the account. Safe to call with no service worker at all (e.g. the app was
 * deleted from the home screen and re-added) — uses getRegistration() rather
 * than serviceWorker.ready, which never resolves without a registration. */
export async function unsubscribeFromPush(): Promise<void> {
  // Local browser push (if any registration exists here).
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const j = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: j.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    // No service worker (fresh install / unsupported) — nothing local to do.
  }

  // Wipe every row for this account, including ones from devices that no
  // longer exist (deleted home-screen installs leave orphans behind).
  const res = await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true }),
  });
  if (!res.ok) throw new Error("Couldn't unsubscribe.");
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
