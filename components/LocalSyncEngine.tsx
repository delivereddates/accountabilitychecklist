"use client";

import { useEffect } from "react";
import { startSyncEngine } from "@/lib/local/sync";

/**
 * Mounts the background sync engine once per document load. Renders nothing.
 * Additive to the (app) layout — the checklist's SWR/DataLoader flow is
 * untouched.
 */
export function LocalSyncEngine() {
  useEffect(() => startSyncEngine(), []);
  return null;
}
