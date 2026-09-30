/**
 * Normalizes a typed answer for Hard-level matching: lowercases, trims, strips
 * surrounding angle brackets and any internal whitespace around them, and
 * collapses repeated whitespace. `<Frame>`, " frame ", and "FRAMESET" all
 * normalize predictably so they can be compared against plain alias strings.
 */
export function normalizeAnswer(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/^<\s*/, "")
    .replace(/\s*>$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks a raw typed answer against a list of accepted (un-normalized) alias
 * strings for a question. Returns true if it matches any of them.
 */
export function isCorrectTypedAnswer(raw, acceptedAnswers) {
  const normalized = normalizeAnswer(raw);
  if (normalized === "") return false;
  return acceptedAnswers.some((accepted) => normalizeAnswer(accepted) === normalized);
}
