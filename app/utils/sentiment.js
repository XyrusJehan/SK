// utils/sentiment.js
//
// Lightweight, offline, lexicon-based sentiment analyzer.
// No API key, no network call — runs entirely on-device, so it works for
// English *and* Filipino/Taglish comments (SK feedback is frequently mixed).
//
// Returns { label: 'positive' | 'neutral' | 'negative', score: number (0–1) }
// matching the shape of the sentiment_label / sentiment_score columns on
// public.comments, so results can be displayed directly or persisted back.

// ─── LEXICON ──────────────────────────────────────────────────────────────
// Keep entries lowercase, no punctuation. Multi-word phrases are matched
// before single words so things like "hindi maganda" aren't scored as a
// lone positive hit on "maganda".

const POSITIVE_PHRASES = [
  'salamat po', 'maraming salamat', 'thank you', 'thank you po',
  'great job', 'well done', 'good job', 'keep it up', 'keep up',
  'proud of', 'sulit na sulit',
];

const POSITIVE_WORDS = [
  // English
  'great', 'good', 'excellent', 'amazing', 'awesome', 'love', 'like',
  'helpful', 'useful', 'nice', 'thanks', 'thank', 'appreciate',
  'appreciated', 'impressive', 'commendable', 'effective', 'efficient',
  'satisfied', 'satisfying', 'proud', 'clear', 'organized', 'informative',
  'transparent', 'transparency', 'timely', 'responsive', 'improvement',
  'improved', 'best', 'perfect', 'wonderful', 'fantastic', 'kudos',
  // Filipino / Taglish
  'galing', 'maganda', 'magaling', 'mahusay', 'salamat', 'masaya',
  'natutuwa', 'nakakatuwa', 'sulit', 'ayos', 'okay', 'ok', 'tama',
  'mabilis', 'malinaw', 'madali', 'astig', 'ang galing', 'ang husay',
  'napakaganda', 'napakagaling', 'solid', 'bongga', 'saludo',
];

const NEGATIVE_PHRASES = [
  'walang silbi', 'walang kwenta', 'sayang lang', 'ang bagal', 'ang tagal',
  'waste of time', 'not good', 'not helpful', 'poor service',
];

const NEGATIVE_WORDS = [
  // English
  'bad', 'poor', 'terrible', 'awful', 'useless', 'slow', 'disappointing',
  'disappointed', 'unsatisfied', 'unsatisfactory', 'problem', 'problematic',
  'confusing', 'complicated', 'delay', 'delayed', 'late', 'lacking',
  'incomplete', 'unclear', 'unresponsive', 'worst', 'horrible', 'frustrating',
  'frustrated', 'annoying', 'inefficient', 'ineffective', 'waste',
  // Filipino / Taglish
  'pangit', 'mali', 'sayang', 'nakakainis', 'nakakabwisit', 'mabagal',
  'kulang', 'hirap', 'mahirap', 'ayaw', 'walang', 'bulok', 'gulo',
  'nakakagalit', 'nakakadismaya', 'panget', 'sablay', 'palpak',
];

// Words that flip the sentiment of the word(s) immediately following them
// within a short window — handles "hindi maganda" (not good), "not helpful", etc.
const NEGATORS = ['hindi', 'wala', 'walang', 'not', 'no', 'never', 'huwag', "n't"];
const NEGATION_WINDOW = 2; // how many words ahead a negator can reach

// ─── HELPERS ──────────────────────────────────────────────────────────────

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countPhraseHits(normalizedText, phrases) {
  let hits = 0;
  for (const phrase of phrases) {
    if (normalizedText.includes(phrase)) hits += 1;
  }
  return hits;
}

function countWordHits(words, wordList, negatorPositions) {
  const wordSet = new Set(wordList);
  let hits = 0;
  let negatedHits = 0;

  words.forEach((word, i) => {
    if (!wordSet.has(word)) return;

    // Was this word preceded by a negator within NEGATION_WINDOW words?
    const isNegated = negatorPositions.some(
      (pos) => i > pos && i - pos <= NEGATION_WINDOW
    );

    if (isNegated) {
      negatedHits += 1;
    } else {
      hits += 1;
    }
  });

  return { hits, negatedHits };
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────

/**
 * Analyze the sentiment of a comment. Works for English, Filipino, and
 * Taglish (mixed) text using a local lexicon — no network call.
 *
 * @param {string} text - the comment content
 * @returns {{ label: 'positive'|'neutral'|'negative', score: number }}
 *   score is 0–1, where ~0.5 is neutral, closer to 1 is positive,
 *   closer to 0 is negative — same scale as sentiment_score in the DB.
 */
export function analyzeSentiment(text) {
  const normalized = normalize(text);

  if (!normalized) {
    return { label: 'neutral', score: 0.5 };
  }

  const words = normalized.split(' ');
  const negatorPositions = [];
  words.forEach((w, i) => {
    if (NEGATORS.includes(w)) negatorPositions.push(i);
  });

  const posPhraseHits = countPhraseHits(normalized, POSITIVE_PHRASES);
  const negPhraseHits = countPhraseHits(normalized, NEGATIVE_PHRASES);

  const { hits: posWordHits, negatedHits: posNegatedHits } =
    countWordHits(words, POSITIVE_WORDS, negatorPositions);
  const { hits: negWordHits, negatedHits: negNegatedHits } =
    countWordHits(words, NEGATIVE_WORDS, negatorPositions);

  // A negated positive word counts toward negative sentiment, and vice versa.
  const positiveScore = posPhraseHits * 1.5 + posWordHits + negNegatedHits;
  const negativeScore = negPhraseHits * 1.5 + negWordHits + posNegatedHits;

  const netSignal = positiveScore - negativeScore;

  if (netSignal === 0) {
    return { label: 'neutral', score: 0.5 };
  }

  // Diminishing-returns curve so a single strong word moves the score
  // meaningfully, while it saturates rather than blowing past 0/1.
  const magnitude = Math.min(Math.abs(netSignal) / (Math.abs(netSignal) + 2), 0.48);
  const score = netSignal > 0 ? 0.5 + magnitude : 0.5 - magnitude;

  let label = 'neutral';
  if (score >= 0.6) label = 'positive';
  else if (score <= 0.4) label = 'negative';

  return { label, score: Math.round(score * 1e6) / 1e6 };
}

export default analyzeSentiment;
