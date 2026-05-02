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

export function isAnswerMatch(guess: string, answer: string): boolean {
  const normalizedGuess = normalizeString(guess);
  const normalizedAnswer = normalizeString(answer);

  if (normalizedGuess === normalizedAnswer) return true;

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
  if (/^\d+$/.test(guess)) return -1;
  if (/^[^a-zA-Z0-9]+$/.test(guess)) return -1;

  return answers.findIndex(answer =>
    answer.correct.some(variant => isAnswerMatch(guess, variant))
  );
}
