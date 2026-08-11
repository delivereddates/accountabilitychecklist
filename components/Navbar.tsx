"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "/", label: "Daily" },
  { href: "/week", label: "Week" },
  { href: "/month", label: "Month" },
  { href: "/year", label: "Year" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
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

        <nav className="flex items-center gap-0.5">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--color-check-soft)] text-[var(--color-check)]"
                    : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
}
