import { createGeoItemHandlers } from "@/lib/geo-master-api";

export const dynamic = "force-dynamic";

export const { GET, PATCH, DELETE } = createGeoItemHandlers("territory", "Territory");
