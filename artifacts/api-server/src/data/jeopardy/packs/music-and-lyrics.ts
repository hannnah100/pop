import type { JeopardyPack } from "../types";

export const musicAndLyrics: JeopardyPack = {
  id: "music-and-lyrics",
  title: "Music & Lyrics",
  description: "Hooks, choruses, one-hit wonders, and hall-of-fame anthems across the decades.",
  categories: [
    {
      name: "Finish the Lyric",
      clues: [
        {
          value: 200,
          question: "'Is this the real life? Is this just ___' — finish this Queen opening line.",
          answer: "What is 'fantasy'?",
          acceptedAnswers: ["fantasy"],
        },
        {
          value: 400,
          question: "'Hello, is it ___ you're looking for?' — finish this Lionel Richie line.",
          answer: "What is 'me'?",
          acceptedAnswers: ["me"],
        },
        {
          value: 600,
          question: "'Cause baby you're a ___, come on show 'em what you're worth' — Katy Perry, please.",
          answer: "What is 'firework'?",
          acceptedAnswers: ["firework"],
        },
        {
          value: 800,
          question: "'I keep on falling in and out of ___ with you' — finish this Alicia Keys line.",
          answer: "What is 'love'?",
          acceptedAnswers: ["love"],
        },
        {
          value: 1000,
          question: "'I came in like a wrecking ___' — fill in this Miley Cyrus shout.",
          answer: "What is 'ball'?",
          acceptedAnswers: ["ball"],
        },
      ],
    },
    {
      name: "Bands by Member",
      clues: [
        {
          value: 200,
          question: "Mick Jagger fronts this still-touring British band formed in 1962.",
          answer: "Who are The Rolling Stones?",
          acceptedAnswers: ["the rolling stones", "rolling stones", "stones"],
        },
        {
          value: 400,
          question: "Dave Grohl drummed for Nirvana before founding this band whose name suggests UFOs.",
          answer: "Who are Foo Fighters?",
          acceptedAnswers: ["foo fighters", "the foo fighters"],
        },
        {
          value: 600,
          question: "Adam Levine fronts this band that made you move like Jagger and was built like a fall-out memory.",
          answer: "Who are Maroon 5?",
          acceptedAnswers: ["maroon 5", "maroon five"],
        },
        {
          value: 800,
          question: "Chris Martin is the frontman of this UK band whose 2005 album 'X&Y' featured 'Speed of Sound.'",
          answer: "Who are Coldplay?",
          acceptedAnswers: ["coldplay"],
        },
        {
          value: 1000,
          question: "Anthony Kiedis and Flea anchor this funk-rock band from Los Angeles best known for 'Californication.'",
          answer: "Who are Red Hot Chili Peppers?",
          acceptedAnswers: ["red hot chili peppers", "rhcp", "chili peppers"],
        },
      ],
    },
    {
      name: "One-Hit Wonders",
      clues: [
        {
          value: 200,
          question: "Carly Rae Jepsen's 2012 single asked you to call her this.",
          answer: "What is 'Maybe'?",
          acceptedAnswers: ["maybe", "call me maybe"],
        },
        {
          value: 400,
          question: "Los del Río's 1996 dance hit asks listeners to do this Spanish-named dance.",
          answer: "What is the Macarena?",
          acceptedAnswers: ["macarena", "the macarena"],
        },
        {
          value: 600,
          question: "Right Said Fred's 1991 hit declared they were too sexy for this body-fitting outerwear.",
          answer: "What is a shirt?",
          acceptedAnswers: ["shirt", "my shirt", "a shirt"],
        },
        {
          value: 800,
          question: "Norwegian band a-ha's 1985 single 'Take On Me' is famous for this animation style in its music video.",
          answer: "What is rotoscoping (pencil-sketch)?",
          acceptedAnswers: ["rotoscoping", "rotoscope", "pencil sketch", "sketch animation"],
        },
        {
          value: 1000,
          question: "PSY's 2012 viral hit was named after this fashionable district in Seoul.",
          answer: "What is Gangnam?",
          acceptedAnswers: ["gangnam", "gangnam style"],
        },
      ],
    },
    {
      name: "Hip-Hop History",
      clues: [
        {
          value: 200,
          question: "Eminem grew up in this Michigan city, the setting for the film '8 Mile.'",
          answer: "What is Detroit?",
          acceptedAnswers: ["detroit"],
        },
        {
          value: 400,
          question: "Snoop Dogg's debut album 'Doggystyle' was produced by this West Coast rap legend.",
          answer: "Who is Dr. Dre?",
          acceptedAnswers: ["dr. dre", "dr dre", "andre young", "dre"],
        },
        {
          value: 600,
          question: "This New York rapper's 1994 debut 'Ready to Die' included 'Juicy' and 'Big Poppa.'",
          answer: "Who is The Notorious B.I.G.?",
          acceptedAnswers: ["the notorious b.i.g.", "notorious big", "biggie", "biggie smalls", "christopher wallace"],
        },
        {
          value: 800,
          question: "This rapper's 'good kid, m.A.A.d city' was set in his hometown of Compton, CA.",
          answer: "Who is Kendrick Lamar?",
          acceptedAnswers: ["kendrick lamar", "kendrick"],
        },
        {
          value: 1000,
          question: "Beyoncé's husband released the album '4:44' in 2017 under this stage name.",
          answer: "Who is Jay-Z?",
          acceptedAnswers: ["jay-z", "jay z", "jayz", "shawn carter"],
        },
      ],
    },
    {
      name: "Movie Soundtracks",
      clues: [
        {
          value: 200,
          question: "Whitney Houston covered Dolly Parton's 'I Will Always Love You' for this 1992 film.",
          answer: "What is The Bodyguard?",
          acceptedAnswers: ["the bodyguard", "bodyguard"],
        },
        {
          value: 400,
          question: "Celine Dion's 'My Heart Will Go On' anchored the soundtrack of this 1997 blockbuster.",
          answer: "What is Titanic?",
          acceptedAnswers: ["titanic"],
        },
        {
          value: 600,
          question: "'Eye of the Tiger' became forever associated with this 1982 boxing sequel.",
          answer: "What is Rocky III?",
          acceptedAnswers: ["rocky iii", "rocky 3"],
        },
        {
          value: 800,
          question: "Pharrell's 'Happy' was originally written for this 2013 animated movie's soundtrack.",
          answer: "What is Despicable Me 2?",
          acceptedAnswers: ["despicable me 2", "despicable me ii"],
        },
        {
          value: 1000,
          question: "Idina Menzel sang 'Let It Go' for this 2013 Disney smash inspired by 'The Snow Queen.'",
          answer: "What is Frozen?",
          acceptedAnswers: ["frozen"],
        },
      ],
    },
    {
      name: "Female Pop Icons",
      clues: [
        {
          value: 200,
          question: "Her 1989 album 'Like a Prayer' fused pop and gospel and got her in trouble with Pepsi.",
          answer: "Who is Madonna?",
          acceptedAnswers: ["madonna"],
        },
        {
          value: 400,
          question: "She re-recorded her early albums starting in 2021 to reclaim her masters; one was '1989 (Taylor's Version).'",
          answer: "Who is Taylor Swift?",
          acceptedAnswers: ["taylor swift", "taylor"],
        },
        {
          value: 600,
          question: "Her 'Lemonade' album was released as a 2016 visual album on HBO and dropped 'Formation' first.",
          answer: "Who is Beyoncé?",
          acceptedAnswers: ["beyoncé", "beyonce"],
        },
        {
          value: 800,
          question: "She rose to fame on 'The X Factor' UK and starred in 2018's 'A Star Is Born' with Bradley Cooper.",
          answer: "Who is Lady Gaga?",
          acceptedAnswers: ["lady gaga", "gaga"],
        },
        {
          value: 1000,
          question: "Her 2010 hit 'Rolling in the Deep' helped 21 become one of the best-selling albums of the century.",
          answer: "Who is Adele?",
          acceptedAnswers: ["adele"],
        },
      ],
    },
  ],
  final: {
    category: "Songwriters",
    question:
      "This singer-songwriter became the first musician to win the Nobel Prize in Literature, awarded in 2016.",
    answer: "Who is Bob Dylan?",
    acceptedAnswers: ["bob dylan", "dylan"],
  },
};
