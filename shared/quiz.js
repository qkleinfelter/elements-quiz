import { customQuestionsForLevel } from "./data/custom-questions.js";
import { inputModeForLevel, poolForLevel } from "./pools.js";
import { buildQuestion } from "./questionTypes.js";
import { shuffle } from "./random.js";

function makeQuestionId(counter) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q-${counter}-${Date.now()}`;
}

function questionFromSource(source, pool, mode, random) {
  // Real elements (from elements.js) are distinguished from custom questions by
  // having a `tag` field; custom questions are already fully shaped.
  if (source.tag) {
    return buildQuestion(source, pool, mode, random);
  }
  return { mode: source.mode, prompt: source.prompt, choices: source.choices, answerIndex: source.answerIndex,
    acceptedAnswers: source.acceptedAnswers, explanation: source.explanation, demo: source.demo };
}

/**
 * Builds a round of questions for a level. Used identically by Solo (state.js) and
 * the Live GameRoom Durable Object, so question generation can never drift between
 * modes (PLAN.md §7).
 *
 * @param {object} params
 * @param {Array} params.elements - The full element bank (src/shared/data/elements.js).
 * @param {"easy"|"medium"|"hard"} params.level
 * @param {number|"all"} params.count - Number of questions, or "all" for the whole pool.
 * @param {() => number} [params.random] - Injectable RNG for deterministic tests.
 * @returns {Array<object>} Questions, each with a unique `id` and full answer data.
 */
export function buildRound({ elements, level, count, random = Math.random }) {
  const pool = poolForLevel(elements, level);
  const mode = inputModeForLevel(level);
  const sources = shuffle([...pool, ...customQuestionsForLevel(level)], random);
  const total = count === "all" ? sources.length : count;

  const questions = [];
  for (let i = 0; i < total; i++) {
    const source = sources[i % sources.length];
    const question = questionFromSource(source, pool, mode, random);
    questions.push({ id: makeQuestionId(i), level, ...question });
  }
  return questions;
}

/**
 * Strips answer-revealing fields (answerIndex, acceptedAnswers, explanation) from a
 * question before it's shown to a player. Used by Live mode; Solo can show the full
 * question locally since there's only one player to "cheat" against.
 */
export function toPublicQuestion(question) {
  const { id, level, mode, prompt, choices, demo } = question;
  return { id, level, mode, prompt, choices, demo };
}
