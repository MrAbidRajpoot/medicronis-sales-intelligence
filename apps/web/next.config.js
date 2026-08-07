const path = require("path");
const fs = require("fs");

// Monorepo: load root .env when apps/web/.env is missing
const rootEnv = path.join(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [],
  experimental: {
    serverComponentsExternalPackages: ["exceljs", "pdfkit"],
  },
};

module.exports = nextConfig;
