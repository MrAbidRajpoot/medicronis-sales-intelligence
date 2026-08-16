const geoSelect = { select: { id: true, name: true }, orderBy: { name: "asc" as const } };

export const managerInclude = {
  territories: geoSelect,
  areas: geoSelect,
  regions: geoSelect,
  zones: geoSelect,
} as const;

type GeoRow = { id: string; name: string };

export function mapManager(m: {
  id: string;
  name: string;
  isActive: boolean;
  territories: GeoRow[];
  areas: GeoRow[];
  regions: GeoRow[];
  zones: GeoRow[];
}) {
  return {
    id: m.id,
    name: m.name,
    isActive: m.isActive,
    territories: m.territories,
    areas: m.areas,
    regions: m.regions,
    zones: m.zones,
    territoryCount: m.territories.length,
    areaCount: m.areas.length,
    regionCount: m.regions.length,
    zoneCount: m.zones.length,
    assignmentCount:
      m.territories.length + m.areas.length + m.regions.length + m.zones.length,
  };
}

/** Normalize an incoming id list; undefined means "leave this model untouched". */
export function parseIdList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return Array.from(
    new Set(
      value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    )
  );
}
