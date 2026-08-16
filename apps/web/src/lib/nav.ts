import {
  LayoutDashboard,
  Upload,
  FileText,
  ClipboardCheck,
  BarChart3,
  Building2,
  Package,
  Layers,
  MapPinned,
  Map,
  Globe2,
  CircleDot,
  UserRound,
  Target,
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
  { href: "/targets", label: "Targets", icon: Target },
  { href: "/distributors", label: "Distributors", icon: Building2 },
  { href: "/managers", label: "Managers", icon: UserRound },
  { href: "/territories", label: "Territories", icon: MapPinned },
  { href: "/areas", label: "Areas", icon: Map },
  { href: "/regions", label: "Regions", icon: Globe2 },
  { href: "/zones", label: "Zones", icon: CircleDot },
  { href: "/products", label: "Products", icon: Package },
  { href: "/product-groups", label: "Product Groups", icon: Layers },
];
