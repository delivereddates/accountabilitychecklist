"use client";

import { useEffect } from "react";
import { SWRConfig } from "swr";
import { Navbar } from "@/components/Navbar";
import { useDashboard } from "@/lib/use-dashboard";

/**
 * Triggers the initial /api/dashboard fetch once per document load. Combined
 * with revalidateOnMount:false / revalidateIfStale:false below, tabs never
 * refetch on their own — they read the cache. (Daily also calls mutate() to
 * resync when it's opened.) Returns nothing.
 */
function DataLoader() {
  const { mutate } = useDashboard();
  useEffect(() => {
    mutate();
  }, [mutate]);
  return null;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateOnMount: false,
        revalidateIfStale: false,
        keepPreviousData: true,
        shouldRetryOnError: true,
        errorRetryCount: 4,
      }}
    >
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <DataLoader />
    </SWRConfig>
  );
}
