import {
  LayoutDashboard,
  Upload,
  FileText,
  ClipboardCheck,
  BarChart3,
  Building2,
  Package,
  Layers,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "review";
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/review", label: "Review Queue", icon: ClipboardCheck, badgeKey: "review" },
  { href: "/reports", label: "SSR Reports", icon: BarChart3 },
  { href: "/distributors", label: "Distributors", icon: Building2 },
  { href: "/products", label: "Products", icon: Package },
  { href: "/product-groups", label: "Product Groups", icon: Layers },
];
