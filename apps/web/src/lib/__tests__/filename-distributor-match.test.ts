/**
 * Filename → distributor matching + ZIP expand (xlsx+pdf).
 * Run: npx tsx --tsconfig tsconfig.json src/lib/__tests__/filename-distributor-match.test.ts
 */
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  findDistributorByFilename,
  resolveXlsxDistributorFromMatch,
  type FilenameDistributorCandidate,
} from "../filename-distributor-match";
import { expandUploadFiles } from "../zip-utils";

const distributors: FilenameDistributorCandidate[] = [
  {
    id: "d1",
    code: "AYAN-TAUNSA",
    name: "Ayan Pharma Taunsa",
    inputMode: "BOTH",
    isActive: true,
  },
  {
    id: "d2",
    code: "AY",
    name: "Ayub Traders",
    inputMode: "EXCEL_ONLY",
    isActive: true,
  },
  {
    id: "d3",
    code: "MED-LAHORE",
    name: "MediCorp Lahore",
    inputMode: "BOTH",
    isActive: true,
  },
  {
    id: "d4",
    code: "SHORT",
    name: "Short Overlap Pharma",
    inputMode: "BOTH",
    isActive: true,
  },
  {
    id: "d5",
    code: "SHORT-X",
    name: "Short Overlap Extended",
    inputMode: "BOTH",
    isActive: true,
  },
];

function testExactAndTokenCodeMatch() {
  const exact = findDistributorByFilename("AYAN-TAUNSA.xlsx", distributors);
  assert.equal(exact.ok, true);
  if (exact.ok) assert.equal(exact.distributor.code, "AYAN-TAUNSA");

  const token = findDistributorByFilename("AYAN-TAUNSA July.xlsx", distributors);
  assert.equal(token.ok, true);
  if (token.ok) assert.equal(token.distributor.code, "AYAN-TAUNSA");
}

function testNameMatch() {
  const result = findDistributorByFilename(
    "Ayan Pharma Taunsa closing.xlsx",
    distributors
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.distributor.id, "d1");
    assert.equal(result.distributor.name, "Ayan Pharma Taunsa");
  }
}

function testPreferLongerCode() {
  // "AY" is a prefix short code; longer AYAN-TAUNSA should win on token match
  const result = findDistributorByFilename("AYAN-TAUNSA report.xlsx", distributors);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.distributor.code, "AYAN-TAUNSA");
}

function testAmbiguousOverlap() {
  const ambiguousDistributors: FilenameDistributorCandidate[] = [
    {
      id: "a1",
      code: "AB",
      name: "Alpha One",
      inputMode: "BOTH",
      isActive: true,
    },
    {
      id: "a2",
      code: "CD",
      name: "Alpha Two",
      inputMode: "BOTH",
      isActive: true,
    },
  ];
  // Equal-length short codes both appear as whole tokens → ambiguous
  const result = findDistributorByFilename("AB CD July.xlsx", ambiguousDistributors);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Ambiguous/i);
    assert.ok(result.candidates && result.candidates.length >= 2);
  }
}

function testNoMatch() {
  const result = findDistributorByFilename("unknown-file.xlsx", distributors);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Could not match distributor from filename/);
  }
}

function testResolveXlsxWithoutForce() {
  const filenameMatch = findDistributorByFilename("AYAN-TAUNSA July.xlsx", distributors);
  const resolved = resolveXlsxDistributorFromMatch({
    forceDistributorId: null,
    filenameMatch,
  });
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.source, "filename");
    assert.equal(resolved.distributorId, "d1");
  }
}

function testResolveXlsxForceWins() {
  const filenameMatch = findDistributorByFilename("AYAN-TAUNSA July.xlsx", distributors);
  const resolved = resolveXlsxDistributorFromMatch({
    forceDistributorId: "forced-id",
    filenameMatch,
  });
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.source, "force");
    assert.equal(resolved.distributorId, "forced-id");
  }
}

async function testExpandZipPdfAndXlsx() {
  const zip = new JSZip();
  zip.file("reports/a.pdf", Buffer.from("%PDF-1.4 fake"));
  zip.file("reports/b.xlsx", Buffer.from("PK fake xlsx"));
  zip.file("__MACOSX/._a.pdf", Buffer.from("junk"));
  zip.file(".DS_Store", Buffer.from("junk"));
  zip.file("notes.txt", Buffer.from("ignore"));
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  const file = new File([new Uint8Array(zipBuffer)], "batch.zip", { type: "application/zip" });
  const expanded = await expandUploadFiles([file]);

  assert.equal(expanded.length, 2);
  const kinds = expanded.map((f) => f.kind).sort();
  assert.deepEqual(kinds, ["pdf", "xlsx"]);
  assert.ok(expanded.every((f) => f.fromZip === true));
  assert.ok(expanded.some((f) => f.name === "a.pdf"));
  assert.ok(expanded.some((f) => f.name === "b.xlsx"));
}

async function main() {
  testExactAndTokenCodeMatch();
  testNameMatch();
  testPreferLongerCode();
  testAmbiguousOverlap();
  testNoMatch();
  testResolveXlsxWithoutForce();
  testResolveXlsxForceWins();
  await testExpandZipPdfAndXlsx();
  console.log("filename-distributor-match + zip-utils tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
