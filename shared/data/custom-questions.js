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
  {
    difficulty: "easy",
    mode: "choice",
    prompt: "Which element played a background sound automatically when an Internet Explorer page loaded?",
    choices: ["<bgsound>", "<blink>", "<marquee>", "<font>"],
    answerIndex: 0,
    explanation: "<bgsound> only ever worked in Internet Explorer; no other browser implemented it.",
  },
  {
    difficulty: "easy",
    mode: "choice",
    prompt: "Before CSS, which single element controlled a piece of text's face, size, and color all at once?",
    choices: ["<font>", "<style>", "<big>", "<basefont>"],
    answerIndex: 0,
    explanation: "<font> bundled typeface, a 1-7 relative size, and color into one deprecated element; CSS split these into separate properties.",
  },
  {
    difficulty: "easy",
    mode: "choice",
    prompt: "Which still-valid HTML5 element gives you a collapsible section with zero JavaScript required?",
    choices: ["<details>", "<collapse>", "<fold>", "<accordion>"],
    answerIndex: 0,
    explanation: "<details>, paired with a <summary> child as its toggle, is a native disclosure widget that needs no script at all.",
  },
  {
    difficulty: "medium",
    mode: "choice",
    prompt: "Which removed element let a web form generate a public/private key pair directly in the browser?",
    choices: ["<keygen>", "<crypto>", "<cert>", "<pki>"],
    answerIndex: 0,
    explanation: "<keygen> was removed from Chrome in version 57 and Firefox in version 69, in favor of the Web Crypto API.",
  },
  {
    difficulty: "medium",
    mode: "choice",
    prompt: "Ruby annotations (the <ruby>/<rt>/<rp> elements) were designed mainly to support pronunciation guides for which writing systems?",
    choices: ["East Asian scripts like Japanese and Chinese", "Cyrillic", "Arabic", "Emoji"],
    answerIndex: 0,
    explanation: "Ruby text commonly shows furigana above Japanese kanji, or similar pronunciation annotations for Chinese characters.",
  },
  {
    difficulty: "medium",
    mode: "choice",
    prompt: "Which method on a <dialog> element automatically dims the rest of the page and traps keyboard focus?",
    choices: ["showModal()", "openModal()", "activate()", "present()"],
    answerIndex: 0,
    explanation: "dialog.showModal() opens it as a modal dialog with focus-trapping and a ::backdrop, all without a library.",
  },
  {
    difficulty: "hard",
    mode: "choice",
    prompt: "Which HTML5 element is parsed but stays completely inert and invisible until JavaScript clones it?",
    choices: ["<template>", "<noscript>", "<canvas>", "<picture>"],
    answerIndex: 0,
    explanation: "<template> content lives in a separate document fragment, outside the normal DOM, until script clones it in.",
  },
  {
    difficulty: "hard",
    mode: "choice",
    prompt: "The original Shadow DOM v0 draft, with its <content> and <shadow> elements, only ever shipped in which browser?",
    choices: ["Chrome", "Firefox", "Safari", "Internet Explorer"],
    answerIndex: 0,
    explanation: "Shadow DOM v0 was a Chrome-only experiment; it was reworked into the cross-browser Shadow DOM v1 (with <slot>) before other browsers implemented it.",
  },
  {
    difficulty: "hard",
    mode: "text",
    prompt: "Type the name of the HTML 2.0 element that rendered a single-line search prompt and could appear directly inside <head>.",
    acceptedAnswers: ["isindex"],
    explanation: "<isindex> is unusual among visible elements for having been valid directly inside <head>, not just <body>.",
  },
  {
    difficulty: "hard",
    mode: "text",
    prompt: "Type the name of the element that displayed its contents verbatim, without parsing any HTML inside it, and predates <pre>.",
    acceptedAnswers: ["xmp"],
    explanation: "<xmp> disabled HTML parsing inside itself, making it an early (if obsolete) way to safely show example markup.",
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
