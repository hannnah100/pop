import type { JeopardyPack } from "../types";

export const moviesAndTV: JeopardyPack = {
  id: "movies-and-tv",
  title: "Movies & TV",
  description: "Lights, camera, streaming. From silver-screen classics to binge-worthy hits.",
  categories: [
    {
      name: "Iconic Quotes",
      clues: [
        {
          value: 200,
          question: "'Here's looking at you, kid' is from this 1942 Bogart-and-Bergman classic set in Morocco.",
          answer: "What is Casablanca?",
          acceptedAnswers: ["casablanca"],
        },
        {
          value: 400,
          question: "Schwarzenegger promised 'I'll be back' in this 1984 James Cameron sci-fi film.",
          answer: "What is The Terminator?",
          acceptedAnswers: ["the terminator", "terminator"],
        },
        {
          value: 600,
          question: "'You can't handle the truth!' is barked by Jack Nicholson in this 1992 military courtroom drama.",
          answer: "What is A Few Good Men?",
          acceptedAnswers: ["a few good men", "few good men"],
        },
        {
          value: 800,
          question: "'I'm the king of the world!' was Leonardo DiCaprio's shout from the bow of this ship.",
          answer: "What is the Titanic?",
          acceptedAnswers: ["titanic", "the titanic", "rms titanic"],
        },
        {
          value: 1000,
          question: "'May the Force be with you' became a cultural touchstone after this 1977 space opera.",
          answer: "What is Star Wars?",
          acceptedAnswers: ["star wars", "a new hope", "star wars a new hope"],
        },
      ],
    },
    {
      name: "Streaming Hits",
      clues: [
        {
          value: 200,
          question: "Netflix's 2016 supernatural hit set in 1980s Indiana introduced us to Eleven and the Upside Down.",
          answer: "What is Stranger Things?",
          acceptedAnswers: ["stranger things"],
        },
        {
          value: 400,
          question: "This Hwang Dong-hyuk Korean Netflix thriller had children's games turned deadly.",
          answer: "What is Squid Game?",
          acceptedAnswers: ["squid game"],
        },
        {
          value: 600,
          question: "On 'Ted Lasso,' the title character coaches this fictional London Premier League club.",
          answer: "What is AFC Richmond?",
          acceptedAnswers: ["afc richmond", "richmond"],
        },
        {
          value: 800,
          question: "Pedro Pascal stars as a bounty hunter caring for Grogu in this Disney+ Star Wars series.",
          answer: "What is The Mandalorian?",
          acceptedAnswers: ["the mandalorian", "mandalorian"],
        },
        {
          value: 1000,
          question: "This HBO drama based on a video game has Pedro Pascal escorting Bella Ramsey through a fungal apocalypse.",
          answer: "What is The Last of Us?",
          acceptedAnswers: ["the last of us", "last of us"],
        },
      ],
    },
    {
      name: "Sitcoms",
      clues: [
        {
          value: 200,
          question: "Ross, Rachel, Monica, Chandler, Joey, and Phoebe drank a lot of coffee at this NBC sitcom's Central Perk.",
          answer: "What is Friends?",
          acceptedAnswers: ["friends"],
        },
        {
          value: 400,
          question: "On 'Seinfeld,' this character's last name was famously revealed in a finale punchline.",
          answer: "Who is George Costanza?",
          acceptedAnswers: ["george costanza", "george", "costanza"],
        },
        {
          value: 600,
          question: "Steve Carell played this clueless Dunder Mifflin regional manager from 2005 to 2011.",
          answer: "Who is Michael Scott?",
          acceptedAnswers: ["michael scott", "michael"],
        },
        {
          value: 800,
          question: "Jerry, Kramer, and Newman lived in this borough of New York City on 'Seinfeld.'",
          answer: "What is Manhattan?",
          acceptedAnswers: ["manhattan"],
        },
        {
          value: 1000,
          question: "On 'Parks and Recreation,' Leslie Knope worked for the Pawnee parks department in this US state.",
          answer: "What is Indiana?",
          acceptedAnswers: ["indiana"],
        },
      ],
    },
    {
      name: "Best Picture Winners",
      clues: [
        {
          value: 200,
          question: "This 1997 James Cameron blockbuster about a doomed ocean liner won 11 Oscars including Best Picture.",
          answer: "What is Titanic?",
          acceptedAnswers: ["titanic"],
        },
        {
          value: 400,
          question: "Bong Joon-ho's class-warfare thriller became the first non-English film to win Best Picture in 2020.",
          answer: "What is Parasite?",
          acceptedAnswers: ["parasite"],
        },
        {
          value: 600,
          question: "This Mel Gibson-directed Scottish epic won Best Picture in 1996.",
          answer: "What is Braveheart?",
          acceptedAnswers: ["braveheart"],
        },
        {
          value: 800,
          question: "Russell Crowe starred as Maximus in this 2000 Ridley Scott Best Picture winner.",
          answer: "What is Gladiator?",
          acceptedAnswers: ["gladiator"],
        },
        {
          value: 1000,
          question: "The Daniels' multiverse comedy with Michelle Yeoh won 7 Oscars including Best Picture in 2023.",
          answer: "What is Everything Everywhere All at Once?",
          acceptedAnswers: ["everything everywhere all at once", "everything everywhere"],
        },
      ],
    },
    {
      name: "Animated Films",
      clues: [
        {
          value: 200,
          question: "In this Pixar movie, a clownfish named Marlin searches the ocean for his son.",
          answer: "What is Finding Nemo?",
          acceptedAnswers: ["finding nemo", "nemo"],
        },
        {
          value: 400,
          question: "This 1994 Disney film features a young lion named Simba and the song 'Hakuna Matata.'",
          answer: "What is The Lion King?",
          acceptedAnswers: ["the lion king", "lion king"],
        },
        {
          value: 600,
          question: "Hayao Miyazaki directed this 2001 Studio Ghibli film about a girl named Chihiro lost in a spirit world.",
          answer: "What is Spirited Away?",
          acceptedAnswers: ["spirited away"],
        },
        {
          value: 800,
          question: "This 2007 Pixar film features Remy the rat dreaming of becoming a chef in Paris.",
          answer: "What is Ratatouille?",
          acceptedAnswers: ["ratatouille"],
        },
        {
          value: 1000,
          question: "In Disney's 'Encanto,' the Madrigal family lives in this South American country.",
          answer: "What is Colombia?",
          acceptedAnswers: ["colombia"],
        },
      ],
    },
    {
      name: "Directors",
      clues: [
        {
          value: 200,
          question: "He directed 'Jaws,' 'E.T.,' and 'Jurassic Park,' and co-founded DreamWorks.",
          answer: "Who is Steven Spielberg?",
          acceptedAnswers: ["steven spielberg", "spielberg"],
        },
        {
          value: 400,
          question: "This director's films include 'Pulp Fiction,' 'Kill Bill,' and 'Once Upon a Time in Hollywood.'",
          answer: "Who is Quentin Tarantino?",
          acceptedAnswers: ["quentin tarantino", "tarantino"],
        },
        {
          value: 600,
          question: "She made history in 2010 winning Best Director for 'The Hurt Locker.'",
          answer: "Who is Kathryn Bigelow?",
          acceptedAnswers: ["kathryn bigelow", "bigelow"],
        },
        {
          value: 800,
          question: "His mind-bending films include 'Memento,' 'Inception,' and 'Tenet.'",
          answer: "Who is Christopher Nolan?",
          acceptedAnswers: ["christopher nolan", "nolan"],
        },
        {
          value: 1000,
          question: "She won Best Director in 2021 for 'Nomadland,' becoming the first Asian woman to do so.",
          answer: "Who is Chloé Zhao?",
          acceptedAnswers: ["chloé zhao", "chloe zhao", "zhao"],
        },
      ],
    },
  ],
  final: {
    category: "Cinema History",
    question:
      "Released in 1939, this Technicolor MGM musical opens in sepia Kansas before a tornado whisks Dorothy off to a colorful land.",
    answer: "What is The Wizard of Oz?",
    acceptedAnswers: ["the wizard of oz", "wizard of oz"],
  },
};
