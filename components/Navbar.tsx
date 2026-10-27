"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { resetCoordinator } from "@/lib/swr-mutations";
import { resetLocalData } from "@/lib/local/reset";

// Single-letter labels keep the bar compact on phones; the full name shows
// on hover/long-press via title, and screen readers use aria-label. The
// productivity sections (T/C/N) sit after a divider — add C and N links when
// those routes land.
const LINKS: { href: string; label: string; aria: string; sepBefore?: boolean }[] = [
  { href: "/", label: "D", aria: "Daily" },
  { href: "/week", label: "W", aria: "Week" },
  { href: "/month", label: "M", aria: "Month" },
  { href: "/year", label: "Y", aria: "Year" },
  { href: "/todos", label: "T", aria: "Todos", sepBefore: true },
  { href: "/calendar", label: "C", aria: "Calendar" },
  { href: "/notes", label: "N", aria: "Notes" },
  { href: "/settings", label: "⚙", aria: "Settings" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    // Drop any queued debounced writes first so they can't fire after logout.
    resetCoordinator();
    // Flush + wipe the local-first DB (bounded 2s) so the next account starts
    // from a clean pull.
    await resetLocalData();
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link
          href="/"
          className="mr-2 flex items-center gap-2 font-semibold tracking-tight"
        >
          <Logo className="h-6 w-6" />
          <span className="hidden sm:inline">Accountability</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <span key={l.href} className="flex items-center">
                {l.sepBefore && (
                  <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
                )}
                <Link
                href={l.href}
                title={l.aria}
                aria-label={l.aria}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold transition-colors",
                  active
                    ? "bg-[var(--color-check-soft)] text-[var(--color-check)]"
                    : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]",
                )}
              >
                {l.href === "/settings" ? (
                  <Settings className="h-4.5 w-4.5" />
                ) : (
                  l.label
                )}
                </Link>
              </span>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          title="Log Out"
          aria-label="Log Out"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] transition-colors hover:bg-black/5"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
