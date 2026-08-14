/** Shared distributor key normalizer (codes/names/filename hints). */
export function normalizeDistributorKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
