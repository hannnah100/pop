#!/usr/bin/env node
// Pop Box celebrity database validation script
// Run: node artifacts/api-server/src/data/daily/validate-pop-box.js
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const celebrities = JSON.parse(
  readFileSync(join(__dirname, "pop-box-celebrities.json"), "utf-8")
);
const categories = JSON.parse(
  readFileSync(join(__dirname, "pop-box-categories.json"), "utf-8")
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

let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

// 1. Minimum count
if (celebrities.length < 1500) {
  fail(`Celebrity count ${celebrities.length} < 1500`);
} else {
  console.log(`✓ Count: ${celebrities.length}`);
}

// 2. No duplicate IDs
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
  console.log("✓ No duplicate IDs");
}

// 3. No duplicate names
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
  console.log("✓ No duplicate names");
}

// 4. All have non-empty alternateNames
const emptyAlts = celebrities.filter(
  (c) => !c.alternateNames || c.alternateNames.length === 0
);
if (emptyAlts.length > 0) {
  fail(
    `Empty alternateNames (${emptyAlts.length}): ${emptyAlts.map((c) => c.id).join(", ")}`
  );
} else {
  console.log("✓ All entries have alternateNames");
}

// 5. All have ≥2 categories
const thin = celebrities.filter(
  (c) => !c.categories || c.categories.length < 2
);
if (thin.length > 0) {
  fail(
    `Entries with <2 categories (${thin.length}): ${thin.map((c) => c.id).join(", ")}`
  );
} else {
  console.log("✓ All entries have ≥2 categories");
}

// 6. No unknown category tags
const unknownTags = new Set();
celebrities.forEach((c) => {
  (c.categories || []).forEach((cat) => {
    if (!validCatIds.has(cat)) unknownTags.add(`${c.id}:${cat}`);
  });
});
if (unknownTags.size > 0) {
  fail(`Unknown category tags: ${[...unknownTags].slice(0, 10).join(", ")}`);
} else {
  console.log("✓ No unknown category tags");
}

// 7. No born-decade conflicts (>1 born-XXXX tag per person)
const bornConflicts = celebrities.filter(
  (c) => (c.categories || []).filter((t) => bornCats.includes(t)).length > 1
);
if (bornConflicts.length > 0) {
  fail(
    `Born-decade conflicts (${bornConflicts.length}): ${bornConflicts.map((c) => c.id).join(", ")}`
  );
} else {
  console.log("✓ No born-decade conflicts");
}

// 8. Priority names present
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
];
const missing = priorityIds.filter((id) => !uniqueIds.has(id));
if (missing.length > 0) {
  fail(`Missing priority names: ${missing.join(", ")}`);
} else {
  console.log("✓ All priority names present");
}

// 9. Category coverage thresholds
const catCounts = {};
celebrities.forEach((c) =>
  (c.categories || []).forEach((t) => {
    catCounts[t] = (catCounts[t] || 0) + 1;
  })
);
const minCoverage = {
  comedian: 50,
  athlete: 100,
  nba: 20,
  nfl: 20,
  soccer: 20,
  love_island_check: 10,
  "drag-race": 10,
  "mcu-actor": 30,
  "emmy-winner": 100,
  "oscar-winner": 50,
  european: 50,
  latino: 30,
  "from-asia": 30,
  "band-member": 50,
};
Object.entries(minCoverage).forEach(([tag, min]) => {
  const realTag = tag === "love_island_check" ? "love-island" : tag;
  const count = catCounts[realTag] || 0;
  if (count < min) {
    fail(`Category "${realTag}" has ${count} entries (minimum ${min})`);
  }
});
console.log("✓ Category coverage thresholds met");

// 10. Spot-check known correct tags
const idMap = Object.fromEntries(celebrities.map((c) => [c.id, c]));
const spotChecks = [
  ["jean-smart", "emmy-winner"],
  ["peter-dinklage", "emmy-winner"],
  ["ayo-edebiri", "born-1990s"],
  ["zendaya", "emmy-winner"],
  ["lenny-kravitz", "grammy-winner"],
];
spotChecks.forEach(([id, tag]) => {
  if (!idMap[id]) {
    fail(`Spot-check: ${id} not found`);
  } else if (!(idMap[id].categories || []).includes(tag)) {
    fail(`Spot-check: ${id} missing tag "${tag}"`);
  }
});
console.log("✓ Spot-checks passed");

// Summary
if (failures === 0) {
  console.log(`\nAll ${10 + Object.keys(minCoverage).length} checks passed ✓`);
  process.exit(0);
} else {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
