"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/layout/logout-button";
import { navItems } from "@/lib/nav";

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

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const badge = item.badgeKey === "review" ? reviewCount : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
