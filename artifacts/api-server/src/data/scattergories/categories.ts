export interface ScatCategory {
  id: string;
  name: string;
  group: "people" | "entertainment" | "brands" | "places" | "things" | "pop-specific";
}

export const ALL_CATEGORIES: ScatCategory[] = [
  // People
  { id: "celebrity", name: "Celebrity", group: "people" },
  { id: "movie-actor", name: "Movie Actor / Actress", group: "people" },
  { id: "tv-actor", name: "TV Actor", group: "people" },
  { id: "musician", name: "Musician or Band", group: "people" },
  { id: "athlete", name: "Professional Athlete", group: "people" },
  { id: "youtuber", name: "Famous YouTuber", group: "people" },
  { id: "fictional-character", name: "Fictional Character", group: "people" },
  { id: "superhero", name: "Superhero", group: "people" },
  { id: "cartoon-character", name: "Cartoon Character", group: "people" },
  { id: "reality-star", name: "Reality TV Star", group: "people" },
  { id: "comedian", name: "Stand-up Comedian", group: "people" },
  { id: "talk-show-host", name: "Talk Show Host", group: "people" },
  { id: "country-singer", name: "Country Singer", group: "people" },
  { id: "rapper", name: "Rapper", group: "people" },
  { id: "pop-star", name: "Pop Star", group: "people" },
  { id: "female-celeb", name: "Famous Woman in Entertainment", group: "people" },
  { id: "male-celeb", name: "Famous Man in Entertainment", group: "people" },
  { id: "tiktok-creator", name: "TikTok Creator", group: "people" },
  { id: "tv-villain", name: "TV Villain", group: "people" },
  { id: "movie-villain", name: "Movie Villain", group: "people" },
  { id: "fashion-designer", name: "Fashion Designer", group: "people" },
  { id: "influencer", name: "Social Media Influencer", group: "people" },
  { id: "celeb-couple", name: "Celebrity Couple", group: "people" },
  { id: "child-star", name: "Former Child Star", group: "people" },
  // Entertainment
  { id: "movie", name: "Movie", group: "entertainment" },
  { id: "tv-show", name: "TV Show", group: "entertainment" },
  { id: "netflix-series", name: "Netflix Series", group: "entertainment" },
  { id: "song-title", name: "Song Title", group: "entertainment" },
  { id: "album", name: "Music Album", group: "entertainment" },
  { id: "music-genre", name: "Music Genre", group: "entertainment" },
  { id: "movie-franchise", name: "Movie Franchise", group: "entertainment" },
  { id: "video-game", name: "Video Game", group: "entertainment" },
  { id: "podcast", name: "Podcast", group: "entertainment" },
  { id: "award-show", name: "Award Show", group: "entertainment" },
  { id: "meme", name: "Famous Meme", group: "entertainment" },
  { id: "anime", name: "Anime", group: "entertainment" },
  { id: "broadway-show", name: "Broadway Musical", group: "entertainment" },
  { id: "sports-team", name: "Sports Team", group: "entertainment" },
  { id: "reality-show", name: "Reality TV Show", group: "entertainment" },
  { id: "game-show", name: "Game Show", group: "entertainment" },
  { id: "superhero-movie", name: "Superhero Movie", group: "entertainment" },
  { id: "horror-movie", name: "Horror Movie", group: "entertainment" },
  { id: "rom-com", name: "Romantic Comedy", group: "entertainment" },
  { id: "animated-movie", name: "Animated Movie", group: "entertainment" },
  { id: "sitcom", name: "Sitcom", group: "entertainment" },
  { id: "documentary", name: "Documentary", group: "entertainment" },
  { id: "hbo-show", name: "HBO Show", group: "entertainment" },
  { id: "music-video", name: "Iconic Music Video", group: "entertainment" },
  { id: "tiktok-trend", name: "TikTok Trend or Sound", group: "entertainment" },
  { id: "viral-video", name: "Viral YouTube Video", group: "entertainment" },
  { id: "collab", name: "Famous Celebrity Collab / Duet", group: "entertainment" },
  // Brands / Tech
  { id: "brand", name: "Famous Brand", group: "brands" },
  { id: "fast-food", name: "Fast Food Chain", group: "brands" },
  { id: "social-media", name: "Social Media App", group: "brands" },
  { id: "tech-company", name: "Tech Company", group: "brands" },
  { id: "streaming-service", name: "Streaming Service", group: "brands" },
  { id: "sports-brand", name: "Sports Brand", group: "brands" },
  { id: "luxury-brand", name: "Luxury Brand / Designer", group: "brands" },
  { id: "car-brand", name: "Car Brand", group: "brands" },
  { id: "studio", name: "Movie Studio", group: "brands" },
  // Places
  { id: "country", name: "Country", group: "places" },
  { id: "city", name: "Famous City", group: "places" },
  { id: "theme-park", name: "Theme Park", group: "places" },
  { id: "tourist-attraction", name: "Tourist Attraction", group: "places" },
  { id: "fictional-place", name: "Fictional Place / Location", group: "places" },
  { id: "restaurant-chain", name: "Restaurant Chain", group: "places" },
  // Things
  { id: "slang-word", name: "Slang Word or Phrase", group: "things" },
  { id: "dance-move", name: "Dance Move", group: "things" },
  { id: "fashion-trend", name: "Fashion Trend", group: "things" },
  { id: "catchphrase", name: "Famous Catchphrase", group: "things" },
  { id: "holiday", name: "Holiday or Event", group: "things" },
  { id: "sports-event", name: "Major Sports Event", group: "things" },
  { id: "food-trend", name: "Food Trend or Viral Recipe", group: "things" },
  { id: "scandal", name: "Celebrity Scandal or Drama", group: "things" },
  { id: "nfl-team", name: "NFL Team", group: "things" },
  { id: "nba-team", name: "NBA Team", group: "things" },
  // Pop-culture specific
  { id: "taylor-swift-song", name: "Taylor Swift Song", group: "pop-specific" },
  { id: "beyonce-song", name: "Beyoncé Song", group: "pop-specific" },
  { id: "friends-character", name: "Friends Character", group: "pop-specific" },
  { id: "pokemon", name: "Pokémon", group: "pop-specific" },
  { id: "marvel-character", name: "Marvel Character", group: "pop-specific" },
  { id: "harry-potter-character", name: "Harry Potter Character", group: "pop-specific" },
  { id: "star-wars-character", name: "Star Wars Character", group: "pop-specific" },
  { id: "spongebob-character", name: "SpongeBob Character", group: "pop-specific" },
  { id: "disney-princess", name: "Disney Princess", group: "pop-specific" },
  { id: "avengers-hero", name: "Avengers Member", group: "pop-specific" },
  { id: "office-character", name: "The Office Character", group: "pop-specific" },
  { id: "got-character", name: "Game of Thrones Character", group: "pop-specific" },
  { id: "stranger-things-character", name: "Stranger Things Character", group: "pop-specific" },
  { id: "simpsons-character", name: "Simpsons Character", group: "pop-specific" },
  { id: "drag-race-queen", name: "RuPaul's Drag Race Queen", group: "pop-specific" },
  { id: "mean-girls-character", name: "Mean Girls Character", group: "pop-specific" },
  { id: "hobbit-character", name: "Lord of the Rings Character", group: "pop-specific" },
  { id: "bts-member", name: "BTS Member", group: "pop-specific" },
  { id: "breaking-bad-character", name: "Breaking Bad Character", group: "pop-specific" },
  { id: "kardashian-member", name: "Kardashian-Jenner Family Member", group: "pop-specific" },
];

export const SAFE_LETTERS = ["A","B","C","D","F","G","H","J","K","L","M","N","P","R","S","T","W"] as const;
export type SafeLetter = typeof SAFE_LETTERS[number];

export const CATEGORIES_PER_ROUND = 10;
export const MAX_CATEGORIES_PER_GROUP = 2;

export function pickCategories(count: number, excludeIds: string[] = []): ScatCategory[] {
  const pool = ALL_CATEGORIES.filter((c) => !excludeIds.includes(c.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const chosen: ScatCategory[] = [];
  const groupCounts: Record<string, number> = {};
  for (const cat of shuffled) {
    if (chosen.length >= count) break;
    const gc = groupCounts[cat.group] ?? 0;
    if (gc >= MAX_CATEGORIES_PER_GROUP) continue;
    chosen.push(cat);
    groupCounts[cat.group] = gc + 1;
  }
  if (chosen.length < count) {
    for (const cat of shuffled) {
      if (chosen.length >= count) break;
      if (!chosen.find((c) => c.id === cat.id)) chosen.push(cat);
    }
  }
  return chosen;
}

export const BOT_ANSWER_POOL: Record<string, string[]> = {
  A: ["Adele","Avatar","Avengers","Ariana Grande","Apple","Amazon","Australia","Aladdin","Angelina Jolie","American Idol","Attack on Titan","Ant-Man","Arcade Fire","ABBA","Aquaman","American Horror Story","Arrested Development","Alexis Rose","Aziz Ansari","Andy Dwyer"],
  B: ["Beyoncé","Breaking Bad","Batman","Billie Eilish","Brooklyn Nine-Nine","Black Panther","Barbie","Bruno Mars","Ben Affleck","Blackpink","Bob's Burgers","Britney Spears","Bridgerton","Bad Bunny","Bluey","Black Mirror","Bohemian Rhapsody","Billy Joel","Brene Brown","Brie Larson"],
  C: ["Cardi B","Captain America","Coldplay","Chris Hemsworth","Clueless","Channing Tatum","Charli D'Amelio","Chris Evans","Coachella","Cobra Kai","Celine Dion","Crazy Rich Asians","Cinderella","Community","Childish Gambino","Cocomelon","Cleopatra","Conan O'Brien","Carole Baskin","Cupcakes"],
  D: ["Drake","Disney","Dua Lipa","Deadpool","Doctor Strange","Destiny's Child","Doja Cat","Duck Tales","Daenerys","Dolce & Gabbana","David Beckham","Divergent","Dwayne Johnson","Dear Evan Hansen","Demi Lovato","Don't Look Up","Death Note","Downton Abbey","Danny DeVito","Dune"],
  F: ["Friends","Frozen","Florence and the Machine","Fast and Furious","Fergie","Fight Club","Finding Nemo","Facebook","Fortnite","Frank Ocean","Fresh Prince","Florence Pugh","Fantastic Four","Fleabag","Fashion Nova","Fenty Beauty","Fleece","Fiesta","Fleetwood Mac","Frida Kahlo"],
  G: ["Game of Thrones","Grease","Lady Gaga","Gossip Girl","Guardians of the Galaxy","Gal Gadot","Grey's Anatomy","Gucci","Glee","Ghostbusters","Get Out","Godzilla","Gilmore Girls","Grammys","Good Place","Gorillaz","Gravity","Gangs of New York","Gigi Hadid","Gary Coleman"],
  H: ["Harry Styles","Harry Potter","Hamilton","Hunger Games","Hailey Bieber","House of Cards","Halsey","Hawkeye","Hulu","Hermione Granger","Hype House","High School Musical","Homecoming","Hot Ones","Hozier","Hilary Duff","Horizon","Handle with Care","Haim","Hugh Jackman"],
  J: ["Justin Bieber","Jennifer Lopez","Jeopardy","John Wick","James Bond","Joker","Jack Black","Jimin","Julia Roberts","Jurassic Park","JoJo Siwa","Juice WRLD","Jennifer Aniston","Jujutsu Kaisen","John Legend","Jersey Shore","Jennifer Lawrence","Jay-Z","Jim Carrey","Jason Momoa"],
  K: ["Kardashian","Kim Kardashian","Katy Perry","Keanu Reeves","Kendall Jenner","Kevin Hart","Kung Fu Panda","Kanye West","K-Pop","Killing Eve","Kim Possible","Khloe Kardashian","Kylie Jenner","Kamala Harris","King Kong","Kevin Bacon","Keke Palmer","Kristen Stewart","Khalid","Kacey Musgraves"],
  L: ["Lady Gaga","Lizzo","Little Mermaid","Lionel Messi","Lorde","Lana Del Rey","Love Island","LeBron James","La La Land","Led Zeppelin","Loki","Legally Blonde","Lonely Island","Lupin","Legend of Zelda","Les Misérables","Lucky Charms","Lovato","Lil Nas X","Logan Paul"],
  M: ["Marvel","Megan Thee Stallion","Michael Jackson","Mariah Carey","Minecraft","Money Heist","Michelle Obama","Mean Girls","Monster Inc","Machine Gun Kelly","Minions","Madonna","Mulan","Missy Elliott","Moana","Magic Mike","Maleficent","Meghan Markle","Matt Damon","Margot Robbie"],
  N: ["Netflix","Nicki Minaj","Naruto","Nike","No Doubt","Neon Genesis","New Girl","Nirvana","Nelly","Newsies","NASA","Notting Hill","Norah Jones","Never Have I Ever","Ned Stark","NWA","Natasha Romanoff","Noah Centineo","Natalie Portman","Nicki Minaj"],
  P: ["Post Malone","Parks and Recreation","Pedro Pascal","Power Rangers","Panic at the Disco","Peppa Pig","Pink","Pitch Perfect","Pokémon","Paramore","Peaky Blinders","Paris Hilton","Paul McCartney","Pixar","Percy Jackson","Priyanka Chopra","Phoebe Bridgers","Parasite","Pam Beesly","Phoebe Buffay"],
  R: ["Rihanna","Ryan Reynolds","Rapunzel","Riverdale","RuPaul","Radiohead","Red (Taylor's Version)","Robert Downey Jr","Romeo and Juliet","Raya","Rick and Morty","Real Housewives","Rocketman","Rami Malek","Ryan Gosling","Regé-Jean Page","Rebel Wilson","Riz Ahmed","Rosalía","Reese Witherspoon"],
  S: ["Selena Gomez","Stranger Things","Spider-Man","Taylor Swift","Saturday Night Fever","SZA","Squid Game","Spotify","Shrek","Suits","Star Wars","SpongeBob","Savage Love","Succession","Shakira","Sandra Bullock","Sabrina Carpenter","Schitt's Creek","Six","Shonda Rhimes"],
  T: ["Taylor Swift","The Office","Thor","TikTok","Titanic","The Weeknd","Twilight","The Crown","Tom Hanks","Tesla","True Blood","The Matrix","Tyler the Creator","Tom Holland","Transformers","Ted Lasso","The Bear","Thanos","The Boys","Tina Fey"],
  W: ["Wicked","Will Smith","Wonder Woman","Witcher","Wonka","Wildest Dreams","White Lotus","Winona Ryder","Wreck-It Ralph","Wandavision","Westworld","Whitney Houston","Wakanda","Walking Dead","Weezer","Weird Al","Will Ferrell","Wendy Williams","Wu-Tang Clan","Willem Dafoe"],
};
