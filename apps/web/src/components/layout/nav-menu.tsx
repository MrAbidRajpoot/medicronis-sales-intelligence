"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  navItems,
  isNavItemActive,
  isNavGroupActive,
  type NavItem,
} from "@/lib/nav";

interface NavMenuProps {
  reviewCount?: number;
  onNavigate?: () => void;
}

function NavLink({
  item,
  pathname,
  badge,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  pathname: string;
  badge?: number;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  if (!item.href) return null;
  const isActive = isNavItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-colors",
        nested ? "px-3 pl-10" : "px-3",
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
}

function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const groupActive = isNavGroupActive(pathname, item);
  const [open, setOpen] = useState(groupActive);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          groupActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        aria-expanded={open}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && item.children && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.href ?? child.label}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NavMenu({ reviewCount = 0, onNavigate }: NavMenuProps) {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        if (item.children?.length) {
          return (
            <NavGroup
              key={item.label}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          );
        }

        const badge = item.badgeKey === "review" ? reviewCount : undefined;
        return (
          <NavLink
            key={item.href ?? item.label}
            item={item}
            pathname={pathname}
            badge={badge}
            onNavigate={onNavigate}
          />
        );
      })}
    </>
  );
}
