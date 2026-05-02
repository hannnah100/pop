function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[':.,\-!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeCommonWords(str: string): string {
  const commonWords = ['the', 'a', 'an', 'and', 'of', 'in', 'to'];
  return str
    .split(' ')
    .filter(w => !commonWords.includes(w))
    .join(' ');
}

function getSignificantWords(str: string): string[] {
  return str.split(' ').filter(word => word.length >= 3);
}

const ABBREVIATIONS: Record<string, string> = {
  gotg: 'guardians of the galaxy',
  mcu: 'marvel cinematic universe',
  lotr: 'lord of the rings',
  hp: 'harry potter',
  sw: 'star wars',
  dr: 'doctor',
  mr: 'mister',
  mrs: 'misses',
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function extractNumbers(str: string): number[] {
  const nums: number[] = [];
  for (const token of str.split(' ')) {
    if (/^\d+$/.test(token)) {
      nums.push(parseInt(token, 10));
    } else if (NUMBER_WORDS[token] !== undefined) {
      nums.push(NUMBER_WORDS[token]);
    }
  }
  return nums.sort((a, b) => a - b);
}

function numbersEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((n, i) => n === b[i]);
}

export function isAnswerMatch(guess: string, answer: string): boolean {
  const normalizedGuess = normalizeString(guess);
  const normalizedAnswer = normalizeString(answer);

  if (normalizedGuess === normalizedAnswer) return true;

  // Numbered sequels are distinct entries. "Iron Man" must NOT fuzzy-match
  // "Iron Man 2", "Iron Man 3", etc. Number-words ("two", "three") count as
  // their digit equivalents so "Iron Man Two" still matches "Iron Man 2".
  const guessNums = extractNumbers(normalizedGuess);
  const answerNums = extractNumbers(normalizedAnswer);
  if (!numbersEqual(guessNums, answerNums)) return false;

  const cleanGuess = removeCommonWords(normalizedGuess);
  const cleanAnswer = removeCommonWords(normalizedAnswer);

  if (cleanGuess === cleanAnswer) return true;

  const guessWords = getSignificantWords(cleanGuess);
  const answerWords = getSignificantWords(cleanAnswer);

  if (guessWords.length > 0) {
    const allWordsMatch = guessWords.every(gw =>
      answerWords.some(aw => aw.includes(gw) || gw.includes(aw))
    );
    if (allWordsMatch) return true;
  }

  let expandedGuess = normalizedGuess;
  let expanded = false;
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g');
    if (regex.test(expandedGuess)) {
      expandedGuess = expandedGuess.replace(regex, full);
      expanded = true;
    }
  }
  if (expanded) return isAnswerMatch(expandedGuess, answer);

  return false;
}

export function findMatchingAnswer(
  guess: string,
  answers: Array<{ display: string; hint: string; correct: string[] }>
): number {
  if (guess.length < 2) return -1;
  if (/^[^a-zA-Z0-9]+$/.test(guess)) return -1;

  const normalizedGuess = normalizeString(guess);

  // Pass 1: exact match (after normalization) against any accepted variant.
  // This guarantees that explicit titles like "Iron Man 2" always resolve to
  // the Iron Man 2 entry — never the looser "Iron Man" entry — even if a
  // fuzzy rule would also match them.
  const exactIdx = answers.findIndex(answer =>
    answer.correct.some(variant => normalizeString(variant) === normalizedGuess),
  );
  if (exactIdx !== -1) return exactIdx;

  // Pass 2: fuzzy match (handles typos, abbreviations, missing common words).
  return answers.findIndex(answer =>
    answer.correct.some(variant => isAnswerMatch(guess, variant)),
  );
}
