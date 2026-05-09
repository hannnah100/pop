// Adds new athletes, new sport-achievement categories, and patches existing
// athlete tags. Idempotent: safe to re-run.
//
// Run: node scripts/tag-athletes.mjs
//
// Achievements verified through end of 2025 / early 2026 season:
//   • NBA Finals 2024: Boston Celtics (Tatum, Brown, Holiday)
//   • NBA Finals 2023: Denver Nuggets (Jokić Finals MVP)
//   • Super Bowl LIX (Feb 2025): Eagles 40-22 Chiefs (Hurts SB MVP)
//   • Super Bowl LVIII (Feb 2024): Chiefs (Mahomes SB MVP)
//   • UCL 2024: Real Madrid (Bellingham, Vinicius); 2025: Real Madrid w/ Mbappé (joined for 2024-25)
//   • Wimbledon 2024: Alcaraz / Krejčíková
//   • US Open 2024: Sinner / Sabalenka
//   • Australian Open 2025: Sinner / Madison Keys

import { readFileSync, writeFileSync } from "node:fs";

const dataDir = new URL("../artifacts/api-server/src/data/daily/", import.meta.url);
const celebsPath = new URL("pop-box-celebrities.json", dataDir);
const catsPath = new URL("pop-box-categories.json", dataDir);

const celebs = JSON.parse(readFileSync(celebsPath, "utf8"));
const cats = JSON.parse(readFileSync(catsPath, "utf8"));

// --- 1) New sport-achievement categories ---
const NEW_CATS = [
  { id: "nba-champion", label: "NBA Champion", group: "sport-achievement" },
  { id: "nba-mvp", label: "NBA MVP", group: "sport-achievement" },
  { id: "finals-mvp", label: "NBA Finals MVP", group: "sport-achievement" },
  { id: "super-bowl-winner", label: "Super Bowl Winner", group: "sport-achievement" },
  { id: "super-bowl-mvp", label: "Super Bowl MVP", group: "sport-achievement" },
  { id: "nfl-mvp", label: "NFL MVP", group: "sport-achievement" },
  { id: "world-cup-winner", label: "World Cup Winner", group: "sport-achievement" },
  { id: "champions-league-winner", label: "Champions League Winner", group: "sport-achievement" },
  { id: "premier-league-champion", label: "Premier League Champion", group: "sport-achievement" },
  { id: "la-liga-winner", label: "La Liga Winner", group: "sport-achievement" },
  { id: "ballon-dor", label: "Ballon d'Or Winner", group: "sport-achievement" },
  { id: "wimbledon-winner", label: "Wimbledon Winner", group: "sport-achievement" },
  { id: "us-open-winner", label: "US Open Winner (Tennis)", group: "sport-achievement" },
  { id: "french-open-winner", label: "French Open Winner", group: "sport-achievement" },
  { id: "australian-open-winner", label: "Australian Open Winner", group: "sport-achievement" },
  { id: "olympic-gold", label: "Olympic Gold Medalist", group: "sport-achievement" },
];
{
  const have = new Set(cats.map((c) => c.id));
  for (const c of NEW_CATS) if (!have.has(c.id)) cats.push(c);
}

// --- 2) New athletes (only added if name not already present) ---
const NEW_ATHLETES = [
  // NFL
  { id: "justin-herbert", name: "Justin Herbert", alternateNames: [], categories: ["athlete", "nfl", "american", "born-1990s"] },
  { id: "bryce-young", name: "Bryce Young", alternateNames: [], categories: ["athlete", "nfl", "american", "born-2000s"] },
  { id: "cj-stroud", name: "C.J. Stroud", alternateNames: ["CJ Stroud"], categories: ["athlete", "nfl", "american", "born-2000s"] },
  { id: "caleb-williams", name: "Caleb Williams", alternateNames: [], categories: ["athlete", "nfl", "american", "born-2000s"] },
  { id: "christian-mccaffrey", name: "Christian McCaffrey", alternateNames: ["CMC"], categories: ["athlete", "nfl", "american", "born-1990s"] },
  { id: "jalen-hurts", name: "Jalen Hurts", alternateNames: [], categories: ["athlete", "nfl", "american", "born-1990s", "super-bowl-winner", "super-bowl-mvp"] },
  { id: "jamarr-chase", name: "Ja'Marr Chase", alternateNames: ["JaMarr Chase"], categories: ["athlete", "nfl", "american", "born-2000s"] },
  { id: "joe-flacco", name: "Joe Flacco", alternateNames: [], categories: ["athlete", "nfl", "american", "born-1980s", "super-bowl-winner", "super-bowl-mvp"] },
  // NBA / WNBA
  { id: "anthony-edwards", name: "Anthony Edwards", alternateNames: ["Ant Edwards"], categories: ["athlete", "nba", "american", "born-2000s"] },
  { id: "tim-duncan", name: "Tim Duncan", alternateNames: [], categories: ["athlete", "nba", "american", "born-1970s", "nba-champion", "nba-mvp", "finals-mvp"] },
  { id: "shaquille-oneal", name: "Shaquille O'Neal", alternateNames: ["Shaq", "Shaquille ONeal"], categories: ["athlete", "nba", "american", "born-1970s", "nba-champion", "nba-mvp", "finals-mvp", "olympic-gold", "athlete-entertainer", "ig-100m"] },
  { id: "kawhi-leonard", name: "Kawhi Leonard", alternateNames: ["The Klaw"], categories: ["athlete", "nba", "american", "born-1990s", "nba-champion", "finals-mvp"] },
  { id: "sue-bird", name: "Sue Bird", alternateNames: [], categories: ["athlete", "nba", "american", "born-1980s", "olympic-gold"] },
  { id: "diana-taurasi", name: "Diana Taurasi", alternateNames: [], categories: ["athlete", "nba", "american", "born-1980s", "olympic-gold"] },
  { id: "sabrina-ionescu", name: "Sabrina Ionescu", alternateNames: [], categories: ["athlete", "nba", "american", "born-1990s"] },
  // Soccer
  { id: "karim-benzema", name: "Karim Benzema", alternateNames: [], categories: ["athlete", "soccer", "european", "born-1980s", "champions-league-winner", "la-liga-winner", "ballon-dor"] },
  { id: "luka-modric", name: "Luka Modrić", alternateNames: ["Luka Modric"], categories: ["athlete", "soccer", "european", "born-1980s", "champions-league-winner", "la-liga-winner", "ballon-dor"] },
  { id: "sergio-ramos", name: "Sergio Ramos", alternateNames: [], categories: ["athlete", "soccer", "european", "born-1980s", "champions-league-winner", "la-liga-winner", "world-cup-winner"] },
  { id: "iker-casillas", name: "Iker Casillas", alternateNames: [], categories: ["athlete", "soccer", "european", "born-1980s", "champions-league-winner", "la-liga-winner", "world-cup-winner"] },
  { id: "toni-kroos", name: "Toni Kroos", alternateNames: [], categories: ["athlete", "soccer", "european", "born-1990s", "champions-league-winner", "la-liga-winner", "world-cup-winner"] },
  { id: "antoine-griezmann", name: "Antoine Griezmann", alternateNames: [], categories: ["athlete", "soccer", "european", "born-1990s", "world-cup-winner", "la-liga-winner"] },
  { id: "ngolo-kante", name: "N'Golo Kanté", alternateNames: ["NGolo Kante", "Kante"], categories: ["athlete", "soccer", "european", "born-1990s", "world-cup-winner", "premier-league-champion", "champions-league-winner"] },
  { id: "christian-pulisic", name: "Christian Pulisic", alternateNames: ["Captain America"], categories: ["athlete", "soccer", "american", "born-1990s", "champions-league-winner"] },
  { id: "sophia-smith", name: "Sophia Smith", alternateNames: [], categories: ["athlete", "soccer", "american", "born-2000s"] },
  { id: "trinity-rodman", name: "Trinity Rodman", alternateNames: [], categories: ["athlete", "soccer", "american", "born-2000s"] },
  { id: "mary-earps", name: "Mary Earps", alternateNames: [], categories: ["athlete", "soccer", "british", "european", "born-1990s"] },
  // Tennis
  { id: "daniil-medvedev", name: "Daniil Medvedev", alternateNames: [], categories: ["athlete", "tennis", "european", "born-1990s", "us-open-winner"] },
  { id: "andy-roddick", name: "Andy Roddick", alternateNames: [], categories: ["athlete", "tennis", "american", "born-1980s", "us-open-winner"] },
  { id: "madison-keys", name: "Madison Keys", alternateNames: [], categories: ["athlete", "tennis", "american", "born-1990s", "australian-open-winner"] },
  { id: "sloane-stephens", name: "Sloane Stephens", alternateNames: [], categories: ["athlete", "tennis", "american", "born-1990s", "us-open-winner"] },
  // MLB
  { id: "mookie-betts", name: "Mookie Betts", alternateNames: [], categories: ["athlete", "american", "born-1990s"] },
  { id: "aaron-judge", name: "Aaron Judge", alternateNames: [], categories: ["athlete", "american", "born-1990s"] },
];

{
  const haveByName = new Set(celebs.map((c) => c.name));
  const haveByAlt = new Set();
  for (const c of celebs) for (const a of c.alternateNames || []) haveByAlt.add(a);
  for (const a of NEW_ATHLETES) {
    if (haveByName.has(a.name) || haveByAlt.has(a.name)) continue;
    celebs.push(a);
    haveByName.add(a.name);
  }
}

// --- 3) Tag patches for existing athletes (additive, by display name) ---
// Each entry adds tags only if missing. Tags chosen conservatively from
// well-known career achievements verified at top of file.
const PATCHES = {
  // === NBA — base + achievements ===
  "Tom Brady": ["athlete", "nfl", "super-bowl-winner", "super-bowl-mvp", "nfl-mvp"],
  "Patrick Mahomes": ["athlete", "nfl", "super-bowl-winner", "super-bowl-mvp", "nfl-mvp"],
  "Aaron Rodgers": ["athlete", "nfl", "super-bowl-winner", "super-bowl-mvp", "nfl-mvp"],
  "Peyton Manning": ["athlete", "nfl", "super-bowl-winner", "super-bowl-mvp", "nfl-mvp"],
  "Travis Kelce": ["athlete", "nfl", "super-bowl-winner"],
  "Drew Brees": ["super-bowl-winner", "super-bowl-mvp"],
  "Eli Manning": ["super-bowl-winner", "super-bowl-mvp"],
  "Russell Wilson": ["super-bowl-winner"],
  "Cam Newton": ["nfl-mvp"],
  "Lamar Jackson": ["nfl-mvp"],
  "Josh Allen": ["nfl-mvp"],
  "Saquon Barkley": ["super-bowl-winner"],
  "Cooper Kupp": ["super-bowl-winner", "super-bowl-mvp"],
  "Tyreek Hill": ["super-bowl-winner"],

  // === NBA ===
  "LeBron James": ["athlete", "nba", "nba-champion", "nba-mvp", "finals-mvp", "olympic-gold"],
  "Stephen Curry": ["athlete", "nba", "nba-champion", "nba-mvp", "finals-mvp", "olympic-gold"],
  "Kevin Durant": ["athlete", "nba", "nba-champion", "nba-mvp", "finals-mvp", "olympic-gold"],
  "Kobe Bryant": ["athlete", "nba", "nba-champion", "nba-mvp", "finals-mvp", "olympic-gold"],
  "Giannis Antetokounmpo": ["nba-champion", "nba-mvp", "finals-mvp"],
  "Nikola Jokić": ["nba-champion", "nba-mvp", "finals-mvp"],
  "Joel Embiid": ["nba-mvp"],
  "Jayson Tatum": ["nba-champion", "olympic-gold"],
  "Jaylen Brown": ["athlete", "nba", "american", "born-1990s", "nba-champion", "finals-mvp"],
  "Anthony Davis": ["nba-champion", "olympic-gold"],
  "Klay Thompson": ["nba-champion", "olympic-gold"],
  "Draymond Green": ["nba-champion", "olympic-gold"],
  "Kyrie Irving": ["nba-champion", "olympic-gold"],
  "James Harden": ["nba-mvp", "olympic-gold"],
  "Russell Westbrook": ["nba-mvp", "olympic-gold"],
  "Damian Lillard": ["olympic-gold"],
  "Devin Booker": ["olympic-gold"],
  "Dwyane Wade": ["nba-champion", "finals-mvp", "olympic-gold"],
  "Chris Bosh": ["nba-champion", "olympic-gold"],
  "Magic Johnson": ["born-1950s", "nba-champion", "nba-mvp", "finals-mvp", "olympic-gold"],
  "Larry Bird": ["born-1950s", "nba-champion", "nba-mvp", "finals-mvp", "olympic-gold"],
  "Kareem Abdul-Jabbar": ["born-1940s", "nba-champion", "nba-mvp", "finals-mvp"],
  "Bill Russell": ["born-1930s", "nba-champion", "nba-mvp"],
  "Scottie Pippen": ["born-1960s", "nba-champion", "olympic-gold"],
  "Charles Barkley": ["born-1960s", "nba-mvp", "olympic-gold"],
  "Dennis Rodman": ["born-1960s", "nba-champion"],
  "Kevin Garnett": ["nba-champion", "nba-mvp", "finals-mvp"],
  "A'ja Wilson": ["nba-mvp"],
  "Breanna Stewart": ["athlete", "nba"],

  // === Soccer ===
  "Lionel Messi": ["athlete", "soccer", "latino", "world-cup-winner", "champions-league-winner", "la-liga-winner", "ballon-dor"],
  "Cristiano Ronaldo": ["athlete", "soccer", "european", "champions-league-winner", "la-liga-winner", "premier-league-champion", "ballon-dor"],
  "Kylian Mbappé": ["athlete", "world-cup-winner", "champions-league-winner", "la-liga-winner"],
  "Erling Haaland": ["athlete", "champions-league-winner", "premier-league-champion"],
  "Vinicius Jr.": ["athlete", "soccer", "champions-league-winner", "la-liga-winner"],
  "Jude Bellingham": ["athlete", "champions-league-winner", "la-liga-winner"],
  "Bukayo Saka": ["athlete"],
  "Harry Kane": ["athlete"],
  "Phil Foden": ["athlete", "premier-league-champion"],
  "Marcus Rashford": ["athlete"],
  "Jack Grealish": ["athlete", "premier-league-champion"],
  "Declan Rice": ["athlete"],
  "Virgil van Dijk": ["athlete", "premier-league-champion", "champions-league-winner"],
  "Kevin De Bruyne": ["athlete", "premier-league-champion", "champions-league-winner"],
  "Mohamed Salah": ["athlete", "premier-league-champion", "champions-league-winner"],
  "Sadio Mané": ["athlete", "premier-league-champion", "champions-league-winner"],
  "Wayne Rooney": ["athlete", "premier-league-champion", "champions-league-winner"],
  "Steven Gerrard": ["athlete", "champions-league-winner"],
  "Frank Lampard": ["athlete", "premier-league-champion", "champions-league-winner"],
  "Thierry Henry": ["athlete", "world-cup-winner", "premier-league-champion", "champions-league-winner"],
  "Ronaldinho": ["athlete", "world-cup-winner", "champions-league-winner", "la-liga-winner", "ballon-dor"],
  "Xavi": ["athlete", "world-cup-winner", "champions-league-winner", "la-liga-winner"],
  "Andrés Iniesta": ["athlete", "world-cup-winner", "champions-league-winner", "la-liga-winner"],
  "Zinedine Zidane": ["athlete", "world-cup-winner", "champions-league-winner", "la-liga-winner", "ballon-dor"],
  "Robert Lewandowski": ["athlete", "la-liga-winner"],
  "Lamine Yamal": ["athlete", "la-liga-winner"],
  "Rodri": ["athlete", "champions-league-winner", "premier-league-champion", "ballon-dor"],
  "Trent Alexander-Arnold": ["athlete", "premier-league-champion", "champions-league-winner"],
  "Pepe": ["athlete", "champions-league-winner", "la-liga-winner"],
  "Roberto Carlos": ["athlete", "world-cup-winner", "champions-league-winner", "la-liga-winner"],
  "Ronaldo Nazário": ["athlete", "world-cup-winner", "la-liga-winner", "ballon-dor"],
  "Zlatan Ibrahimović": ["athlete", "champions-league-winner", "la-liga-winner"],
  "Neymar Jr.": ["athlete", "soccer", "champions-league-winner", "la-liga-winner"],
  "Alex Morgan": ["athlete", "world-cup-winner"],
  "Megan Rapinoe": ["athlete", "world-cup-winner"],

  // === Tennis ===
  "Roger Federer": ["athlete", "tennis", "european", "wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner"],
  "Rafael Nadal": ["athlete", "tennis", "european", "wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner", "olympic-gold"],
  "Novak Djokovic": ["athlete", "tennis", "european", "wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner", "olympic-gold"],
  "Serena Williams": ["athlete", "tennis", "wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner", "olympic-gold"],
  "Venus Williams": ["athlete", "tennis", "wimbledon-winner", "us-open-winner", "olympic-gold"],
  "Andy Murray": ["wimbledon-winner", "us-open-winner", "olympic-gold"],
  "Naomi Osaka": ["athlete", "tennis", "from-asia", "us-open-winner", "australian-open-winner"],
  "Coco Gauff": ["us-open-winner", "french-open-winner"],
  "Iga Świątek": ["french-open-winner", "us-open-winner"],
  "Aryna Sabalenka": ["australian-open-winner", "us-open-winner"],
  "Jannik Sinner": ["australian-open-winner", "us-open-winner"],
  "Carlos Alcaraz": ["wimbledon-winner", "us-open-winner", "french-open-winner"],
  "Maria Sharapova": ["wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner"],
  "Steffi Graf": ["wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner", "olympic-gold"],
  "Martina Navratilova": ["wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner"],
  "Pete Sampras": ["wimbledon-winner", "us-open-winner", "australian-open-winner"],
  "Andre Agassi": ["wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner", "olympic-gold"],
  "Billie Jean King": ["wimbledon-winner", "us-open-winner", "french-open-winner", "australian-open-winner"],
  "Ash Barty": ["wimbledon-winner", "french-open-winner", "australian-open-winner"],

  // === F1 / other base tagging ===
  "Lewis Hamilton": ["athlete", "f1"],
  "Simone Biles": ["athlete", "olympian", "olympic-gold"],
  "Michael Phelps": ["olympic-gold"],
  "Katie Ledecky": ["olympic-gold"],
  "Sha'Carri Richardson": ["olympic-gold"],
  "Aly Raisman": ["olympic-gold"],
  "Gabby Douglas": ["olympic-gold"],
  "Sunisa Lee": ["olympic-gold"],
  "Eliud Kipchoge": ["olympic-gold"],
  "Carl Lewis": ["olympic-gold", "born-1960s"],
  "Muhammad Ali": ["olympic-gold", "born-1940s"],
  "Anthony Joshua": ["olympic-gold"],
  "Oscar De La Hoya": ["olympic-gold"],
  "Manny Pacquiao": ["athlete"],
  "Ronda Rousey": ["olympic-gold"],

  // === MLB / cricket / golf / boxing — add `athlete` where missing ===
  "Bryce Harper": ["athlete"],
  "Mike Trout": ["athlete"],
  "Shohei Ohtani": ["athlete"],
  "Max Scherzer": ["athlete"],
  "Derek Jeter": ["athlete"],
  "Alex Rodriguez": ["athlete"],
  "Ricky Ponting": ["athlete"],
  "Sachin Tendulkar": ["athlete"],
  "Ben Stokes": ["athlete"],
  "Joe Root": ["athlete"],
  "James Anderson": ["athlete"],
  "AB de Villiers": ["athlete"],
  "Phil Mickelson": ["athlete"],
  "Bubba Watson": ["athlete"],
  "Dustin Johnson": ["athlete"],
  "Jon Rahm": ["athlete"],
  "Scottie Scheffler": ["athlete"],
  "Brooks Koepka": ["athlete"],
  "Rory McIlroy": ["athlete"],
  "Mike Tyson": ["athlete"],
  "Tyson Fury": ["athlete"],
  "Deontay Wilder": ["athlete"],
  "Canelo Álvarez": ["athlete"],
  "Stephen Hendry": ["athlete"],
  "Peter Wright": ["athlete"],

  // === Other gap fills ===
  "Lewis Hamilton ": ["athlete", "f1"], // safety dup ignored at apply time
  "Justin Jefferson": [],
  "Davante Adams": [],

  // === Tag-fills surfaced by Ball Knowers grid validation (12-grid pool) ===
  "Lionel Messi": ["olympic-gold"], // Argentina, Beijing 2008
  "Jannik Sinner": ["wimbledon-winner"], // 2025 Wimbledon
  "Charles Barkley": ["born-1960s"], // 1963; needed for olympic-gold × 60s cell
};

{
  const byName = new Map();
  for (const c of celebs) byName.set(c.name, c);
  let patched = 0;
  for (const [name, tags] of Object.entries(PATCHES)) {
    const c = byName.get(name);
    if (!c) continue;
    const have = new Set(c.categories);
    let added = 0;
    for (const t of tags) {
      if (!have.has(t)) {
        c.categories.push(t);
        have.add(t);
        added++;
      }
    }
    if (added) patched++;
  }
  console.log(`Patched ${patched} existing athletes.`);
}

writeFileSync(catsPath, JSON.stringify(cats, null, 2) + "\n");
writeFileSync(celebsPath, JSON.stringify(celebs, null, 2) + "\n");

// --- 4) Sanity report: confirm every Ball Knowers grid cell has ≥1 valid athlete ---
const haveCat = (c, t) => c.categories.includes(t);
const matchCell = (rowCat, colCat) =>
  celebs.filter((c) => haveCat(c, rowCat) && haveCat(c, colCat)).map((c) => c.name);

const grids = [
  // === Original 4 ===
  { name: "NBA Greats", rows: ["nba-champion","nba-mvp","finals-mvp"], cols: ["born-1980s","born-1990s","olympic-gold"] },
  { name: "Soccer Trophies", rows: ["champions-league-winner","la-liga-winner","premier-league-champion"], cols: ["ballon-dor","born-1990s","european"] },
  { name: "NFL Legends", rows: ["super-bowl-mvp","super-bowl-winner","nfl-mvp"], cols: ["born-1970s","born-1980s","born-1990s"] },
  { name: "Tennis Slams", rows: ["wimbledon-winner","us-open-winner","french-open-winner"], cols: ["australian-open-winner","american","european"] },
  // === New 8 ===
  { name: "Hardwood Hall", rows: ["nba-champion","nba-mvp","finals-mvp"], cols: ["born-1970s","born-1990s","european"] },
  { name: "Pitch Royalty", rows: ["world-cup-winner","ballon-dor","premier-league-champion"], cols: ["champions-league-winner","la-liga-winner","european"] },
  { name: "Court Conquest", rows: ["wimbledon-winner","us-open-winner","australian-open-winner"], cols: ["american","european","born-1980s"] },
  { name: "Globe Soccer", rows: ["champions-league-winner","premier-league-champion","la-liga-winner"], cols: ["world-cup-winner","european","born-2000s"] },
  { name: "NBA Olympic", rows: ["nba-mvp","nba-champion","olympic-gold"], cols: ["born-1960s","american","born-1990s"] },
  { name: "Gridiron Greats", rows: ["super-bowl-winner","super-bowl-mvp","nfl"], cols: ["nfl-mvp","born-1980s","born-1990s"] },
  { name: "Tennis Now", rows: ["us-open-winner","australian-open-winner","wimbledon-winner"], cols: ["born-2000s","american","european"] },
  { name: "Sport Era Mix", rows: ["athlete","nba","soccer"], cols: ["born-1980s","born-1990s","born-2000s"] },
];

console.log("\nGrid validation:");
for (const g of grids) {
  console.log(`\n[${g.name}]`);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const m = matchCell(g.rows[r], g.cols[c]);
      const status = m.length === 0 ? "✗ EMPTY" : `✓ ${m.length}`;
      console.log(`  (${g.rows[r]} × ${g.cols[c]}): ${status} ${m.slice(0, 3).join(", ")}${m.length > 3 ? "…" : ""}`);
    }
  }
}
