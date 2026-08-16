"use client";

import { Globe2 } from "lucide-react";
import { GeoMasterPage } from "@/components/geo-master-page";

export default function RegionsPage() {
  return (
    <GeoMasterPage
      title="Regions"
      description="Manage regions used on distributors, imports, and SSR reports"
      apiPath="/api/regions"
      icon={Globe2}
      singular="Region"
    />
  );
}
