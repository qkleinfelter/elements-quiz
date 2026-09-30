// Small set of hand-written trivia questions that don't fit the per-element generators
// in questionTypes.js (PLAN.md §5). Each entry is already shaped like a generator's
// output (see buildQuestion in questionTypes.js) plus a `difficulty` tag that controls
// which levels it can appear in, the same way an element's own `difficulty` field does.
import { inputModeForLevel } from "../pools.js";

export const customQuestions = [
  {
    difficulty: "medium",
    mode: "choice",
    prompt: "Which of these was a real HTML element, not a browser urban legend?",
    choices: ["<blink>", "<flicker>", "<strobe>", "<pulse>"],
    answerIndex: 0,
    explanation: "<blink> was a real Netscape element that made text blink; the others were never real HTML.",
  },
  {
    difficulty: "hard",
    mode: "choice",
    prompt: "Netscape Navigator 4's proprietary positioning model was based on which element?",
    choices: ["<layer>", "<position>", "<zindex>", "<absolute>"],
    answerIndex: 0,
    explanation: "<layer> (and its inline sibling <ilayer>) let Netscape 4 position content independently, before CSS positioning became standard.",
  },
  {
    difficulty: "easy",
    mode: "choice",
    prompt: "Which pair of elements were both used to make text look struck-through?",
    choices: ["<strike> and <s>", "<blink> and <marquee>", "<big> and <tt>", "<center> and <font>"],
    answerIndex: 0,
    explanation: "<strike> was the original deprecated element; <s> is its still-valid semantic-light replacement for non-accurate content.",
  },
  {
    difficulty: "hard",
    mode: "text",
    prompt: "Type the name of the Shadow DOM v1 element that replaced the abandoned <content>/<shadow> pair.",
    acceptedAnswers: ["slot"],
    explanation: "<slot> replaced <content> and <shadow> when Shadow DOM was simplified from v0 to v1.",
  },
];

/**
 * Custom questions eligible for a given level: same difficulty-pooling rule as
 * pools.js, further restricted to whichever input mode ("choice" | "text") that
 * level actually uses, since a custom question's mode is fixed at authoring time.
 */
export function customQuestionsForLevel(level) {
  const byLevel = {
    easy: ["easy"],
    medium: ["easy", "medium"],
    hard: ["medium", "hard"],
  };
  const allowed = byLevel[level] ?? [];
  const mode = inputModeForLevel(level);
  return customQuestions.filter((q) => allowed.includes(q.difficulty) && q.mode === mode);
}
