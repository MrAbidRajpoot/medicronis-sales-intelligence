import { normalizeDistributorKey } from "@/lib/distributor-normalize";

export type FilenameDistributorCandidate = {
  id: string;
  code: string;
  name: string;
  inputMode: "BOTH" | "EXCEL_ONLY";
  isActive: boolean;
};

export type FindDistributorByFilenameResult =
  | { ok: true; distributor: FilenameDistributorCandidate }
  | {
      ok: false;
      error: string;
      candidates?: FilenameDistributorCandidate[];
    };

/** Strip path + extension; replace _/- with spaces; collapse whitespace. */
export function prepareFilenameForDistributorMatch(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const withoutExt = base.replace(/\.[^.]+$/i, "");
  return withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokensOf(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function isContiguousTokenMatch(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false;
  if (needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function nameMatchesIncludeLogic(preparedBasename: string, distributorName: string): boolean {
  const normHint = normalizeDistributorKey(preparedBasename);
  const normName = normalizeDistributorKey(distributorName);
  if (!normHint || !normName) return false;
  if (normName === normHint || normName.includes(normHint) || normHint.includes(normName)) {
    return true;
  }
  const hintParts = preparedBasename
    .split(/[,\s]+/)
    .filter((p) => p.length > 1)
    .map((p) => p.toUpperCase());
  const nameUpper = distributorName.toUpperCase();
  return hintParts.length >= 2 && hintParts.every((part) => nameUpper.includes(part));
}

function preferLongerCodeMatches(
  candidates: FilenameDistributorCandidate[]
): FilenameDistributorCandidate[] {
  if (candidates.length <= 1) return candidates;
  let maxLen = 0;
  for (const c of candidates) {
    const len = normalizeDistributorKey(c.code).length;
    if (len > maxLen) maxLen = len;
  }
  return candidates.filter((c) => normalizeDistributorKey(c.code).length === maxLen);
}

function uniqueOrAmbiguous(
  fileName: string,
  candidates: FilenameDistributorCandidate[],
  via: string
): FindDistributorByFilenameResult {
  if (candidates.length === 1) {
    return { ok: true, distributor: candidates[0] };
  }
  if (candidates.length >= 2) {
    const labels = candidates.map((c) => `${c.name} (${c.code})`).join(", ");
    return {
      ok: false,
      error: `Ambiguous distributor match from filename "${fileName}" (${via}): ${labels}`,
      candidates,
    };
  }
  return {
    ok: false,
    error: `Could not match distributor from filename: ${fileName}`,
  };
}

/**
 * Resolve distributor from an upload filename (code or name).
 * Priority: exact code → whole-token code → name include (same rules as PDF hints).
 * Prefers longer/more specific code matches within a tier.
 */
export function findDistributorByFilename(
  fileName: string,
  distributors: FilenameDistributorCandidate[]
): FindDistributorByFilenameResult {
  const active = distributors.filter((d) => d.isActive);
  const prepared = prepareFilenameForDistributorMatch(fileName);
  if (!prepared) {
    return {
      ok: false,
      error: `Could not match distributor from filename: ${fileName}`,
    };
  }

  const normBasename = normalizeDistributorKey(prepared);
  const basenameTokens = tokensOf(prepared);

  // 1) Exact code match against basename
  const exact = active.filter(
    (d) => normalizeDistributorKey(d.code) === normBasename
  );
  if (exact.length > 0) {
    return uniqueOrAmbiguous(fileName, preferLongerCodeMatches(exact), "exact code");
  }

  // 2) Basename contains code as whole token(s)
  const tokenMatches = active.filter((d) => {
    const codeTokens = tokensOf(d.code);
    return isContiguousTokenMatch(basenameTokens, codeTokens);
  });
  const tokenPreferred = preferLongerCodeMatches(tokenMatches);
  if (tokenPreferred.length > 0) {
    return uniqueOrAmbiguous(fileName, tokenPreferred, "code token");
  }

  // 3) Name include logic (same as findDistributorByExtractHints)
  const nameMatches = active.filter((d) => nameMatchesIncludeLogic(prepared, d.name));
  if (nameMatches.length > 0) {
    return uniqueOrAmbiguous(fileName, nameMatches, "name");
  }

  return {
    ok: false,
    error: `Could not match distributor from filename: ${fileName}`,
  };
}

/** Pure resolve helper for Excel uploads (force wins; else filename match). */
export function resolveXlsxDistributorFromMatch(params: {
  forceDistributorId: string | null;
  filenameMatch: FindDistributorByFilenameResult;
}):
  | { ok: true; distributorId: string; source: "force" | "filename" }
  | { ok: false; error: string; candidates?: FilenameDistributorCandidate[] } {
  if (params.forceDistributorId) {
    return {
      ok: true,
      distributorId: params.forceDistributorId,
      source: "force",
    };
  }
  if (params.filenameMatch.ok) {
    return {
      ok: true,
      distributorId: params.filenameMatch.distributor.id,
      source: "filename",
    };
  }
  return {
    ok: false,
    error: params.filenameMatch.error,
    candidates: params.filenameMatch.candidates,
  };
}
