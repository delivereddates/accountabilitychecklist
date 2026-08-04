"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const from =
        new URLSearchParams(window.location.search).get("from") || "/";
      router.replace(from);
      router.refresh();
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data?.error || "Login failed.");
    setLoading(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-check-soft)]">
            <ListChecks className="h-6 w-6 text-[var(--color-check)]" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Accountability Checklist
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enter the shared password to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"
        >
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-check)] focus:ring-2 focus:ring-[var(--color-check-soft)]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="mt-2 text-sm text-[var(--color-nocheck)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full rounded-lg bg-[var(--color-check)] py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
