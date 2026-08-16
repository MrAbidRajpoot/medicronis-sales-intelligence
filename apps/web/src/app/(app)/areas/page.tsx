"use client";

import { Map } from "lucide-react";
import { GeoMasterPage } from "@/components/geo-master-page";

export default function AreasPage() {
  return (
    <GeoMasterPage
      title="Areas"
      description="Manage areas used on distributors, imports, and SSR reports"
      apiPath="/api/areas"
      icon={Map}
      singular="Area"
    />
  );
}
