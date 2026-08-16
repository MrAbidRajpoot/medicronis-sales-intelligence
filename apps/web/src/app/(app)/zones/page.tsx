"use client";

import { CircleDot } from "lucide-react";
import { GeoMasterPage } from "@/components/geo-master-page";

export default function ZonesPage() {
  return (
    <GeoMasterPage
      title="Zones"
      description="Manage zones used on distributors, imports, and SSR reports"
      apiPath="/api/zones"
      icon={CircleDot}
      singular="Zone"
    />
  );
}
