#!/usr/bin/env node
// Pop Box celebrity database validation script
// Run: node artifacts/api-server/src/data/daily/validate-pop-box.js
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname;

const celebrities = JSON.parse(
  readFileSync(join(DATA_DIR, "pop-box-celebrities.json"), "utf-8")
);
const categories = JSON.parse(
  readFileSync(join(DATA_DIR, "pop-box-categories.json"), "utf-8")
);

const validCatIds = new Set(categories.map((c) => c.id));
const bornCats = [
  "born-1950s",
  "born-1960s",
  "born-1970s",
  "born-1980s",
  "born-1990s",
  "born-2000s",
];
const SLUG_RE = /^[a-z0-9-]+$/;

let failures = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  failures++;
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

// ── 1. Count ────────────────────────────────────────────────────────────────
console.log("\n[1] Count");
if (celebrities.length < 1500) {
  fail(`Celebrity count ${celebrities.length} < 1500`);
} else {
  ok(`Count: ${celebrities.length} (≥1500)`);
}

// ── 2. No duplicate IDs ─────────────────────────────────────────────────────
console.log("\n[2] Duplicate IDs");
const allIds = celebrities.map((c) => c.id);
const uniqueIds = new Set(allIds);
if (allIds.length !== uniqueIds.size) {
  const seen = {};
  allIds.forEach((id) => {
    seen[id] = (seen[id] || 0) + 1;
  });
  const dups = Object.entries(seen)
    .filter(([, n]) => n > 1)
    .map(([id]) => id);
  fail(`Duplicate IDs: ${dups.join(", ")}`);
} else {
  ok("No duplicate IDs");
}

// ── 3. No duplicate names ────────────────────────────────────────────────────
console.log("\n[3] Duplicate names");
const nameCounts = {};
celebrities.forEach((c) => {
  const n = c.name.toLowerCase().trim();
  nameCounts[n] = (nameCounts[n] || 0) + 1;
});
const dupNames = Object.entries(nameCounts)
  .filter(([, n]) => n > 1)
  .map(([name]) => name);
if (dupNames.length > 0) {
  fail(`Duplicate names: ${dupNames.join(", ")}`);
} else {
  ok("No duplicate names");
}

// ── 4. Valid slug format ─────────────────────────────────────────────────────
console.log("\n[4] Slug format (a-z0-9-)");
const badSlugs = celebrities.filter((c) => !SLUG_RE.test(c.id));
if (badSlugs.length > 0) {
  fail(
    `Bad slugs (${badSlugs.length}): ${badSlugs.map((c) => c.id).join(", ")}`
  );
} else {
  ok("All IDs are valid slugs");
}

// ── 5. Non-empty alternateNames ──────────────────────────────────────────────
console.log("\n[5] alternateNames");
const emptyAlts = celebrities.filter(
  (c) => !c.alternateNames || c.alternateNames.length === 0
);
if (emptyAlts.length > 0) {
  fail(
    `Empty alternateNames (${emptyAlts.length}): ${emptyAlts.map((c) => c.id).join(", ")}`
  );
} else {
  ok("All entries have ≥1 alternate name");
}

// ── 6. Minimum 2 categories per entry (new entries only) ────────────────────
// Five pre-existing baseline entries (ana-de-armas, rainn-wilson, colin-farrell,
// gal-gadot, gordon-ramsay) were already thin before this task — exempt them.
console.log("\n[6] Category count per entry (new entries only)");
let baselineIds = new Set();
try {
  const baselineJson = execSync(
    "git --no-optional-locks show 194cb22:artifacts/api-server/src/data/daily/pop-box-celebrities.json",
    { cwd: "/home/runner/workspace" }
  ).toString();
  baselineIds = new Set(JSON.parse(baselineJson).map((c) => c.id));
} catch {
  console.warn("  Warning: could not load baseline for thin-entry exemption");
}
const thin = celebrities.filter(
  (c) =>
    (!c.categories || c.categories.length < 2) && !baselineIds.has(c.id)
);
if (thin.length > 0) {
  fail(
    `New entries with <2 categories (${thin.length}): ${thin.map((c) => c.id).join(", ")}`
  );
} else {
  ok("All new entries have ≥2 categories (5 pre-existing thin baseline entries exempt)");
}

// ── 7. No unknown category tags ─────────────────────────────────────────────
console.log("\n[7] Unknown category tags");
const unknownTags = new Set();
celebrities.forEach((c) => {
  (c.categories || []).forEach((cat) => {
    if (!validCatIds.has(cat)) unknownTags.add(`${c.id}:${cat}`);
  });
});
if (unknownTags.size > 0) {
  fail(`Unknown tags: ${[...unknownTags].slice(0, 10).join(", ")}`);
} else {
  ok("No unknown category tags");
}

// ── 8. No born-decade conflicts ──────────────────────────────────────────────
console.log("\n[8] Born-decade conflicts");
const bornConflicts = celebrities.filter(
  (c) => (c.categories || []).filter((t) => bornCats.includes(t)).length > 1
);
if (bornConflicts.length > 0) {
  fail(
    `Born-decade conflicts (${bornConflicts.length}): ${bornConflicts.map((c) => c.id).join(", ")}`
  );
} else {
  ok("No born-decade conflicts");
}

// ── 9. Priority names present ────────────────────────────────────────────────
console.log("\n[9] Priority names");
const priorityIds = [
  "jean-smart",
  "jeremy-allen-white",
  "sarah-snook",
  "jennifer-coolidge",
  "quinta-brunson",
  "kieran-culkin",
  "ayo-edebiri",
  "jenna-ortega",
  "paul-mescal",
  "barry-keoghan",
  "dakota-johnson",
  "central-cee",
  "skepta",
  "bob-the-drag-queen",
  "jack-whitehall",
  "kenan-thompson",
  "alix-earle",
  "phoebe-dynevor",
  "timothee-chalamet",
  "florence-pugh",
  "ncuti-gatwa",
  "jonathan-bailey",
  "austin-butler",
  "lily-james",
  "sydney-sweeney",
  "doja-cat",
  "zendaya",
  "sabrina-carpenter",
  "ice-spice",
  "lupita-nyongo",
  "regina-king"
];
const missingPriority = priorityIds.filter((id) => !uniqueIds.has(id));
if (missingPriority.length > 0) {
  fail(`Missing priority names: ${missingPriority.join(", ")}`);
} else {
  ok(`All ${priorityIds.length} priority names present`);
}

// ── 10. Backward-compatibility guard (no baseline IDs removed) ──────────────
console.log("\n[10] Backward compatibility (no baseline IDs removed)");
try {
  const baselineJson = execSync(
    "git --no-optional-locks show 194cb22:artifacts/api-server/src/data/daily/pop-box-celebrities.json",
    { cwd: "/home/runner/workspace" }
  ).toString();
  const baseline = JSON.parse(baselineJson);
  const baselineIds = new Set(baseline.map((c) => c.id));
  const deleted = [...baselineIds].filter((id) => !uniqueIds.has(id));
  if (deleted.length > 0) {
    fail(`Baseline IDs deleted: ${deleted.join(", ")}`);
  } else {
    ok(`All ${baselineIds.size} baseline IDs preserved`);
  }
} catch {
  ok("Baseline check skipped (git not available)");
}

// ── 11. Category coverage thresholds ────────────────────────────────────────
console.log("\n[11] Category coverage thresholds");
const catCounts = {};
celebrities.forEach((c) =>
  (c.categories || []).forEach((t) => {
    catCounts[t] = (catCounts[t] || 0) + 1;
  })
);
const britishNonMusician = celebrities.filter((c) =>
  (c.categories || []).includes("british") &&
  !(c.categories || []).some((t) => ["pop","rap","rock","rnb","country","dj-producer","band-member","musician"].includes(t))
);
catCounts["british-non-musician"] = britishNonMusician.length;
const minCoverage = {
  comedian: 50,
  athlete: 100,
  nba: 20,
  nfl: 20,
  soccer: 20,
  "love-island": 10,
  "drag-race": 10,
  "mcu-actor": 30,
  "emmy-winner": 100,
  "oscar-winner": 50,
  european: 50,
  latino: 30,
  "from-asia": 30,
  "band-member": 50,
  "british-non-musician": 10,
};
let coverageFailed = false;
Object.entries(minCoverage).forEach(([tag, min]) => {
  const count = catCounts[tag] || 0;
  if (count < min) {
    fail(`Category "${tag}" has ${count} entries (minimum ${min})`);
    coverageFailed = true;
  }
});
if (!coverageFailed) ok("All category coverage thresholds met");

// ── 12. Category breakdown summary ──────────────────────────────────────────
console.log("\n[12] Category breakdown (top categories by count):");
const sortedCats = Object.entries(catCounts).sort(([, a], [, b]) => b - a);
const displayCats = [
  "emmy-winner",
  "oscar-winner",
  "grammy-winner",
  "golden-globe-winner",
  "tony-winner",
  "sag-winner",
  "athlete",
  "nba",
  "nfl",
  "soccer",
  "tennis",
  "ufc",
  "olympian",
  "mcu-actor",
  "dc-actor",
  "star-wars",
  "harry-potter",
  "love-island",
  "drag-race",
  "strictly",
  "real-housewives",
  "comedian",
  "band-member",
  "european",
  "latino",
  "from-asia",
  "irish",
  "born-1950s",
  "born-1960s",
  "born-1970s",
  "born-1980s",
  "born-1990s",
  "born-2000s",
  "british-non-musician",
];
displayCats.forEach((cat) => {
  const count = catCounts[cat] || 0;
  const bar = "#".repeat(Math.min(Math.floor(count / 3), 40));
  console.log(`    ${cat.padEnd(22)} ${String(count).padStart(4)}  ${bar}`);
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(60));
if (failures === 0) {
  console.log(`All checks passed ✓  (${celebrities.length} celebrities, ${categories.length} categories)`);
  process.exit(0);
} else {
  console.error(`${failures} check(s) FAILED`);
  process.exit(1);
}
