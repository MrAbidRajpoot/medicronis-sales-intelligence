"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { NavMenu } from "@/components/layout/nav-menu";

export function TopBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    fetch("/api/review")
      .then((r) => r.json())
      .then((d) => setReviewCount(d.count ?? d.items?.length ?? 0))
      .catch(() => {});
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
            M
          </div>
        </div>

        <div className="hidden lg:block">
          <h2 className="text-lg font-semibold text-foreground">Medicronis Sales Intelligence</h2>
          <p className="text-xs text-muted-foreground">Secondary Sales Report Automation</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium text-amber-800 sm:px-3 sm:text-xs">
            Trial — Medicronis
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            DA
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <nav className="fixed left-0 top-0 h-full w-64 space-y-1 overflow-y-auto bg-white p-4 shadow-xl">
            <p className="mb-4 px-3 text-sm font-semibold">Medicronis</p>
            <NavMenu reviewCount={reviewCount} onNavigate={() => setMobileOpen(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
