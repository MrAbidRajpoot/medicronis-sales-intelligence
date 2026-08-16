"use client";

import { MapPinned } from "lucide-react";
import { GeoMasterPage } from "@/components/geo-master-page";

export default function TerritoriesPage() {
  return (
    <GeoMasterPage
      title="Territories"
      description="Manage territories used on distributors, imports, and SSR reports"
      apiPath="/api/territories"
      icon={MapPinned}
      singular="Territory"
    />
  );
}
