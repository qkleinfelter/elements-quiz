/** Fisher-Yates shuffle. Returns a new array; does not mutate the input. Accepts an
 * injectable `random` function (defaults to Math.random) so tests can be deterministic. */
export function shuffle(array, random = Math.random) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Picks `count` distinct random items from `array` (no repeats), via shuffle + slice. */
export function sample(array, count, random = Math.random) {
  return shuffle(array, random).slice(0, count);
}
