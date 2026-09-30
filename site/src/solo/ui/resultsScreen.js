/** Renders the final results screen: score, high score, and a per-question review. */
export function renderResultsScreen(container, state, onPlayAgain) {
  container.textContent = "";

  const heading = document.createElement("h1");
  heading.textContent = "Results";
  container.appendChild(heading);

  const score = document.createElement("p");
  score.className = "final-score";
  score.textContent = `Final score: ${state.score}`;
  container.appendChild(score);

  const highScore = document.createElement("p");
  const isNewHighScore = state.score === state.highScore && state.score > 0;
  highScore.textContent = isNewHighScore
    ? `New high score for ${state.settings.level}!`
    : `${capitalize(state.settings.level)} high score: ${state.highScore}`;
  container.appendChild(highScore);

  const correctCount = state.answers.filter((a) => a.correct).length;
  const summary = document.createElement("p");
  summary.textContent = `${correctCount} / ${state.answers.length} correct`;
  container.appendChild(summary);

  const review = document.createElement("ol");
  review.className = "review-list";
  state.answers.forEach((answer) => {
    const item = document.createElement("li");
    item.className = answer.correct ? "review-correct" : "review-incorrect";
    const prompt = document.createElement("p");
    prompt.textContent = answer.question.prompt;
    const explanation = document.createElement("p");
    explanation.className = "explanation";
    explanation.textContent = answer.question.explanation;
    item.append(prompt, explanation);
    review.appendChild(item);
  });
  container.appendChild(review);

  const playAgainButton = document.createElement("button");
  playAgainButton.type = "button";
  playAgainButton.className = "primary-button";
  playAgainButton.textContent = "Play Again";
  playAgainButton.addEventListener("click", onPlayAgain);
  container.appendChild(playAgainButton);
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
