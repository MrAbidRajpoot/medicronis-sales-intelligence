"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import { NavMenu } from "@/components/layout/nav-menu";

export function Sidebar() {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    fetch("/api/review")
      .then((r) => r.json())
      .then((d) => setReviewCount(d.count ?? d.items?.length ?? 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          M
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Medicronis</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sales Intelligence</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <NavMenu reviewCount={reviewCount} />
      </nav>

      <div className="border-t p-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
