"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Period views for the daily-tracker section. Vertical rail next to the
// content on md+, horizontal chip row above it on phones. (The top navbar
// links the sections — the app home is the calendar; Daily lives here.)
const VIEWS = [
  { href: "/daily", label: "Daily", icon: CalendarCheck },
  { href: "/week", label: "Week", icon: CalendarRange },
  { href: "/month", label: "Month", icon: CalendarDays },
  { href: "/year", label: "Year", icon: Calendar },
];

export function SummarySidebar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Daily tracker views"
      className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:w-40 md:flex-col md:overflow-visible md:pb-0"
    >
      {VIEWS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
                : "text-[var(--muted)] hover:bg-black/5",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
