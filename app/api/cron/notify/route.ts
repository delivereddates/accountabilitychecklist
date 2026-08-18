import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { localDateISO, localHourMinute } from "@/lib/time";
import { sendToUser } from "@/lib/push";
import {
  claimPushLog,
  deletePushLogOlderThanDays,
  getActiveNotificationSettings,
  markPushLogSent,
  releasePushLog,
} from "@/lib/db";

// Node runtime (web-push + node:crypto); 60s gives multi-user sends room on
// the Hobby plan's default 10s budget.
export const runtime = "nodejs";
export const maxDuration = 60;

const SLOTS = [11, 17, 21] as const;
type Slot = (typeof SLOTS)[number];

const PAYLOADS: Record<Slot, { title: string; body: string }> = {
  11: { title: "Midday check-in", body: "Half the day gone — how's your list looking?" },
  17: { title: "Late-afternoon reminder", body: "A few hours left — check off what you can." },
  21: { title: "Last call", body: "Finish today's checks before midnight." },
};

const WINDOW_MIN = 60; // fire when local time is 0–59 min past the slot

/** Constant-time Bearer check against CRON_SECRET. */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  const a = createHash("sha256").update(auth).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed — never run notifications unauthenticated.
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 404 },
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Dev-only override: pretend it's exactly `slot` o'clock for every user so
  // the route can be exercised without waiting for a real hour.
  const devSlot = process.env.NODE_ENV !== "production"
    ? Number(req.nextUrl.searchParams.get("slot"))
    : NaN;
  const useDev = SLOTS.includes(devSlot as Slot);

  const now = new Date();
  let claimed = 0;
  let sent = 0;
  let skipped = 0;

  try {
    const rows = await getActiveNotificationSettings();
    for (const s of rows) {
      const tz = s.timezone!;
      const { hour, minute } = useDev
        ? { hour: devSlot as number, minute: 0 }
        : localHourMinute(now, tz);
      const date = useDev ? "1970-01-01" : localDateISO(now, tz);

      const slot = SLOTS.find((h) => {
        const on = h === 11 ? s.notify_11 : h === 17 ? s.notify_17 : s.notify_21;
        if (!on) return false;
        // "Just passed": within the last hour (handles hourly ticks landing
        // anywhere in the window, incl. half-hour-offset timezones).
        const passed = hour * 60 + minute - h * 60;
        return passed >= 0 && passed < WINDOW_MIN;
      });
      if (!slot) {
        skipped++;
        continue;
      }

      // Claim (user, date, slot) — exactly-once across overlapping runs.
      const claimId = await claimPushLog(s.user_id, date, slot);
      if (!claimId) continue;
      claimed++;
      try {
        sent += await sendToUser(s.user_id, PAYLOADS[slot]);
        await markPushLogSent(claimId);
      } catch {
        // Config error (e.g. VAPID missing) — release the claim so the next
        // hourly run retries this slot instead of silently losing it.
        await releasePushLog(claimId).catch(() => {});
      }
    }
    await deletePushLogOlderThanDays(60);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "notify failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, claimed, sent, skipped });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
