import { sample, shuffle } from "./random.js";

const CHOICE_COUNT = 4;

function buildChoiceQuestion({ prompt, correctText, distractorPool, distractorField, explanation, demo, random }) {
  const distractorTexts = distractorPool
    .map((el) => el[distractorField])
    .filter((text) => typeof text === "string" && text !== correctText);
  const uniqueDistractors = [...new Set(distractorTexts)];
  const chosenDistractors = sample(uniqueDistractors, CHOICE_COUNT - 1, random);
  const choices = shuffle([correctText, ...chosenDistractors], random);
  return {
    mode: "choice",
    prompt,
    choices,
    answerIndex: choices.indexOf(correctText),
    explanation,
    demo,
  };
}

function buildTextQuestion({ prompt, acceptedAnswers, explanation, demo }) {
  return {
    mode: "text",
    prompt,
    acceptedAnswers,
    explanation,
    demo,
  };
}

function explanationFor(el) {
  const parts = [el.summary];
  if (el.replacement) parts.push(`Replaced by: ${el.replacement}.`);
  if (el.funFact) parts.push(el.funFact);
  return parts.join(" ");
}

/** "What did <tag> do?" - choice only; distractors are other elements' summaries. */
export function whatDidItDo(el, pool, random = Math.random) {
  return buildChoiceQuestion({
    prompt: `What did ${el.tag} do?`,
    correctText: el.summary,
    distractorPool: pool.filter((other) => other.id !== el.id),
    distractorField: "summary",
    explanation: explanationFor(el),
    random,
  });
}

/**
 * "Which element did X?" / "Name the tag" - supports both choice and text mode,
 * since the answer is always a clean tag name that aliases can match.
 */
export function nameTheTag(el, pool, mode, random = Math.random) {
  const prompt = `Which element matches this description: "${el.summary}"`;
  if (mode === "text") {
    return buildTextQuestion({
      prompt,
      acceptedAnswers: el.aliases,
      explanation: explanationFor(el),
    });
  }
  return buildChoiceQuestion({
    prompt,
    correctText: el.tag,
    distractorPool: pool.filter((other) => other.id !== el.id),
    distractorField: "tag",
    explanation: explanationFor(el),
    random,
  });
}

/** "<tag> was superseded by...?" - choice only; requires el.replacement. */
export function whatReplacedIt(el, pool, random = Math.random) {
  if (!el.replacement) return null;
  return buildChoiceQuestion({
    prompt: `${el.tag} was superseded by...`,
    correctText: el.replacement,
    distractorPool: pool.filter((other) => other.id !== el.id && other.replacement),
    distractorField: "replacement",
    explanation: explanationFor(el),
    random,
  });
}

/** "Which browser/spec introduced <tag>?" - choice only. */
export function whatOrigin(el, pool, random = Math.random) {
  return buildChoiceQuestion({
    prompt: `Which browser or spec introduced ${el.tag}?`,
    correctText: el.origin,
    distractorPool: pool.filter((other) => other.id !== el.id),
    distractorField: "origin",
    explanation: explanationFor(el),
    random,
  });
}

const SPECIMEN_PROMPTS = [
  "Which element renders like this?",
  "This is a live specimen. Which element produced it?",
  "Identify the element behind this rendered output.",
];

/**
 * "Identify this rendered element" - supports both choice and text mode.
 * Requires el.demo (a trusted, hard-coded markup snippet). Prompt wording is picked
 * at random from a small pool so repeated specimen questions don't all read identically.
 */
export function identifySpecimen(el, pool, mode, random = Math.random) {
  if (!el.demo) return null;
  const prompt = SPECIMEN_PROMPTS[Math.floor(random() * SPECIMEN_PROMPTS.length)];
  if (mode === "text") {
    return buildTextQuestion({
      prompt,
      acceptedAnswers: el.aliases,
      explanation: explanationFor(el),
      demo: el.demo,
    });
  }
  return buildChoiceQuestion({
    prompt,
    correctText: el.tag,
    distractorPool: pool.filter((other) => other.id !== el.id),
    distractorField: "tag",
    explanation: explanationFor(el),
    demo: el.demo,
    random,
  });
}

/**
 * Builds one question for `el`, picking a generator at random from whichever
 * are valid for this element and input mode. `mode` is "choice" or "text"
 * (see pools.js / inputModeForLevel). Falls back to nameTheTag, which is
 * always valid, if no other generator applies.
 */
export function buildQuestion(el, pool, mode, random = Math.random) {
  const candidates = [];
  if (mode === "choice") {
    candidates.push(() => whatDidItDo(el, pool, random));
    candidates.push(() => whatOrigin(el, pool, random));
    if (el.replacement) candidates.push(() => whatReplacedIt(el, pool, random));
  }
  candidates.push(() => nameTheTag(el, pool, mode, random));
  if (el.demo) candidates.push(() => identifySpecimen(el, pool, mode, random));

  const shuffledCandidates = shuffle(candidates, random);
  for (const build of shuffledCandidates) {
    const question = build();
    if (question) return question;
  }
  // Unreachable in practice: nameTheTag never returns null.
  return nameTheTag(el, pool, mode, random);
}
