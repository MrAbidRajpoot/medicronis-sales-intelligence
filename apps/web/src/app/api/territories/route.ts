import { createGeoCollectionHandlers } from "@/lib/geo-master-api";

export const dynamic = "force-dynamic";

export const { GET, POST } = createGeoCollectionHandlers("territory", "Territory");
