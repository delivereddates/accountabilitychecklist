import { NextResponse, type NextRequest } from "next/server";
import { requireApiKey, withV1Cors } from "@/lib/api-auth";
import { isValidISODate, jsonError } from "@/lib/api-helpers";
import { insertApiEvent, touchApiKey } from "@/lib/db";

/**
 * External write-only API: add a calendar event to the key owner's account.
 *
 *   POST /api/v1/events
 *   Authorization: Bearer ac_…
 *   { "title": "Dentist", "date": "2026-11-04", "start": "09:30",
 *     "end": "10:15", "location": "123 Main St", "externalId": "id-1" }
 *
 * `start`/`end` are "HH:MM" local times; omitting `start` (or allDay:true)
 * makes an all-day event. `externalId` is optional dedup: sending the same
 * id again returns the existing event (200) instead of duplicating it (201).
 * Events are single-day; end must be after start. The row syncs to the
 * owner's devices on their next pull.
 */
export const runtime = "nodejs";

const HH_MM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

interface EventInput {
  title: string;
  description: string;
  date: string;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
  location: string | null;
  externalId: string | null;
}

/** Validate + normalize the body; every branch returns a caller-ready error. */
function parseEvent(
  body: Record<string, unknown>,
): { error: string } | { input: EventInput } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 500)
    return { error: "title is required (1–500 characters)." };
  if (typeof body.date !== "string" || !isValidISODate(body.date))
    return { error: "date is required and must be a valid YYYY-MM-DD." };

  // description is NOT NULL in the schema — default to "" like the UI does.
  let description = "";
  if (body.description != null) {
    if (typeof body.description !== "string" || body.description.length > 5000)
      return { error: "description must be a string (≤5000 characters)." };
    description = body.description.trim();
  }
  let location: string | null = null;
  if (body.location != null) {
    if (typeof body.location !== "string" || body.location.length > 500)
      return { error: "location must be a string (≤500 characters)." };
    location = body.location.trim();
  }
  let externalId: string | null = null;
  if (body.externalId != null) {
    if (
      typeof body.externalId !== "string" ||
      !body.externalId.trim() ||
      body.externalId.length > 500
    ) {
      return {
        error: "externalId must be a non-empty string (≤500 characters).",
      };
    }
    externalId = body.externalId.trim();
  }
  if (body.allDay != null && typeof body.allDay !== "boolean")
    return { error: "allDay must be a boolean." };

  const hasStart = body.start != null;
  const hasEnd = body.end != null;
  let startMin: number | null = null;
  let endMin: number | null = null;
  if (hasStart) {
    if (typeof body.start !== "string" || !HH_MM_RE.test(body.start))
      return { error: "start must be HH:MM (00:00–23:59)." };
    startMin = toMin(body.start);
  }
  if (hasEnd) {
    if (typeof body.end !== "string" || !HH_MM_RE.test(body.end))
      return { error: "end must be HH:MM (00:00–23:59)." };
    endMin = toMin(body.end);
  }

  // Omitted allDay infers from start's presence: no start → all-day.
  const allDay = body.allDay ?? !hasStart;
  if (allDay && (hasStart || hasEnd))
    return { error: "start/end are not allowed for all-day events." };
  if (!allDay && !hasStart)
    return { error: "start is required for timed events." };
  if (
    hasEnd &&
    startMin !== null &&
    endMin !== null &&
    endMin <= startMin
  ) {
    return {
      error: "end must be after start (events can't cross midnight).",
    };
  }

  return {
    input: {
      title,
      description,
      date: body.date,
      allDay,
      startMin: allDay ? null : startMin,
      endMin: allDay ? null : endMin,
      location,
      externalId,
    },
  };
}

export function OPTIONS() {
  return withV1Cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  try {
    const key = await requireApiKey(req);
    if (!key) {
      return withV1Cors(
        NextResponse.json(
          { error: "Invalid or missing API key." },
          { status: 401 },
        ),
      );
    }

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return withV1Cors(
        NextResponse.json(
          { error: "Request body must be a JSON object." },
          { status: 400 },
        ),
      );
    }

    const parsed = parseEvent(body);
    if ("error" in parsed) {
      return withV1Cors(
        NextResponse.json({ error: parsed.error }, { status: 400 }),
      );
    }

    const [result] = await Promise.all([
      insertApiEvent(key.userId, parsed.input),
      // Best-effort bookkeeping in parallel — a failed touch never blocks
      // the write (and never fires after the response, which Vercel freezes).
      touchApiKey(key.keyId).catch(() => null),
    ]);
    // existed = the externalId dedup hit an already-imported row.
    return withV1Cors(
      NextResponse.json(
        { event: result.record },
        { status: result.existed ? 200 : 201 },
      ),
    );
  } catch (e) {
    return withV1Cors(jsonError(e));
  }
}
