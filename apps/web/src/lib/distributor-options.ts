export const DISTRIBUTOR_REGIONS = [
  { value: "SOUTH", label: "South" },
  { value: "CENTER_1", label: "Center-1" },
  { value: "CENTER_2", label: "Center-2" },
  { value: "NORTH_1", label: "North-1" },
  { value: "NORTH_2", label: "North-2" },
] as const;

export const DISTRIBUTOR_COUNTRIES = [
  { value: "PAK_1", label: "Pak-1" },
  { value: "PAK_2", label: "Pak-2" },
] as const;

export type DistributorRegionValue = (typeof DISTRIBUTOR_REGIONS)[number]["value"];
export type DistributorCountryValue = (typeof DISTRIBUTOR_COUNTRIES)[number]["value"];

const REGION_LABELS = Object.fromEntries(DISTRIBUTOR_REGIONS.map((r) => [r.value, r.label])) as Record<
  DistributorRegionValue,
  string
>;

const COUNTRY_LABELS = Object.fromEntries(DISTRIBUTOR_COUNTRIES.map((c) => [c.value, c.label])) as Record<
  DistributorCountryValue,
  string
>;

const REGION_BY_LABEL = Object.fromEntries(
  DISTRIBUTOR_REGIONS.flatMap((r) => [
    [r.label.toLowerCase(), r.value],
    [r.value.toLowerCase(), r.value],
    [r.label.toLowerCase().replace(/-/g, " "), r.value],
  ])
) as Record<string, DistributorRegionValue>;

const COUNTRY_BY_LABEL = Object.fromEntries(
  DISTRIBUTOR_COUNTRIES.flatMap((c) => [
    [c.label.toLowerCase(), c.value],
    [c.value.toLowerCase(), c.value],
  ])
) as Record<string, DistributorCountryValue>;

export const VALID_REGIONS = new Set<string>(DISTRIBUTOR_REGIONS.map((r) => r.value));
export const VALID_COUNTRIES = new Set<string>(DISTRIBUTOR_COUNTRIES.map((c) => c.value));

export function parseRegionInput(value: string): DistributorRegionValue | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (VALID_REGIONS.has(trimmed)) return trimmed as DistributorRegionValue;
  return REGION_BY_LABEL[trimmed.toLowerCase()] ?? null;
}

export function parseCountryInput(value: string): DistributorCountryValue | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (VALID_COUNTRIES.has(trimmed)) return trimmed as DistributorCountryValue;
  return COUNTRY_BY_LABEL[trimmed.toLowerCase()] ?? null;
}

export function formatRegionLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return REGION_LABELS[value as DistributorRegionValue] ?? value;
}

export function formatCountryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return COUNTRY_LABELS[value as DistributorCountryValue] ?? value;
}

/** Major cities across all provinces and territories of Pakistan. */
export const PAKISTAN_CITIES = [
  "Abbottabad",
  "Attock",
  "Badin",
  "Bahawalnagar",
  "Bahawalpur",
  "Bannu",
  "Burewala",
  "Chakwal",
  "Charsadda",
  "Chiniot",
  "Chishtian",
  "Chaman",
  "Dadu",
  "Daska",
  "Dera Ghazi Khan",
  "Dera Ismail Khan",
  "Faisalabad",
  "Gilgit",
  "Gojra",
  "Gujranwala",
  "Gujrat",
  "Gwadar",
  "Hafizabad",
  "Haripur",
  "Hub",
  "Hyderabad",
  "Islamabad",
  "Jacobabad",
  "Jaranwala",
  "Jhang",
  "Jhelum",
  "Kamalia",
  "Kamoke",
  "Karachi",
  "Kasur",
  "Khanewal",
  "Khanpur",
  "Khairpur",
  "Khuzdar",
  "Kohat",
  "Kot Addu",
  "Lahore",
  "Larkana",
  "Mansehra",
  "Mardan",
  "Mianwali",
  "Mingora",
  "Mirpur",
  "Mirpur Khas",
  "Multan",
  "Muzaffarabad",
  "Muzaffargarh",
  "Narowal",
  "Nawabshah",
  "Nowshera",
  "Okara",
  "Pakpattan",
  "Peshawar",
  "Quetta",
  "Rahim Yar Khan",
  "Rawalpindi",
  "Rawalakot",
  "Sahiwal",
  "Sargodha",
  "Shikarpur",
  "Sheikhupura",
  "Sialkot",
  "Sibi",
  "Skardu",
  "Sukkur",
  "Swabi",
  "Toba Tek Singh",
  "Turbat",
  "Umerkot",
  "Vehari",
  "Wah Cantonment",
] as const;
