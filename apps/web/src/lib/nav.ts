import {
  LayoutDashboard,
  Upload,
  FileText,
  ClipboardCheck,
  BarChart3,
  Building2,
  Package,
  Boxes,
  Layers,
  MapPinned,
  Map,
  Globe2,
  CircleDot,
  UserRound,
  Target,
  Store,
  FileSpreadsheet,
  type LucideIcon,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  badgeKey?: "review";
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/review", label: "Review Queue", icon: ClipboardCheck, badgeKey: "review" },
  { href: "/distributors", label: "Distributors", icon: Building2 },
  { href: "/products", label: "Products", icon: Package },
  { href: "/targets", label: "Targets", icon: Target },
  {
    label: "Setup",
    icon: Settings,
    children: [
      { href: "/territories", label: "Territories", icon: MapPinned },
      { href: "/areas", label: "Areas", icon: Map },
      { href: "/regions", label: "Regions", icon: Globe2 },
      { href: "/zones", label: "Zones", icon: CircleDot },
      { href: "/managers", label: "Managers", icon: UserRound },
      { href: "/product-groups", label: "Product Groups", icon: Layers },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    children: [
      { href: "/reports", label: "SSR Reports", icon: FileSpreadsheet },
      { href: "/reports/distributor-wise", label: "Distributor Wise", icon: Store },
      { href: "/reports/product-wise", label: "Product Wise", icon: Boxes },
    ],
  },
];

/** Leaf nav items only (excludes group parents). */
export function flattenNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) =>
    item.children?.length ? flattenNavItems(item.children) : item.href ? [item] : []
  );
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer a more specific nav item when paths nest (e.g. /reports vs /reports/distributor-wise).
  const leaves = flattenNavItems(navItems);
  return !leaves.some(
    (other) =>
      other.href &&
      other.href !== href &&
      other.href.startsWith(`${href}/`) &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`))
  );
}

export function isNavGroupActive(pathname: string, item: NavItem): boolean {
  if (!item.children?.length) return false;
  return flattenNavItems(item.children).some(
    (child) => child.href != null && isNavItemActive(pathname, child.href)
  );
}
