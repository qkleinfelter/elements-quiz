import { renderSpecimen } from "./specimen.js";

/**
 * Renders the question or feedback screen. `state` is a Solo QuizState `state` object
 * (screen "question" or "feedback"). `callbacks` is `{ onAnswer(response), onNext() }`.
 * Keyboard support: keys 1-4 select a choice answer; Enter submits a typed answer or
 * advances from the feedback screen.
 */
export function renderQuestionScreen(container, state, callbacks) {
  container.textContent = "";
  const question = state.questions[state.currentIndex];
  const lastAnswer = state.screen === "feedback" ? state.answers.at(-1) : null;

  const progress = document.createElement("p");
  progress.className = "progress";
  progress.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length} · Score: ${state.score}`;
  container.appendChild(progress);

  const countdown = document.createElement("div");
  countdown.className = "countdown";
  countdown.id = "countdown";
  const countdownText = document.createElement("span");
  countdownText.id = "countdown-text";
  const countdownBar = document.createElement("div");
  countdownBar.id = "countdown-bar";
  countdownBar.className = "countdown-bar";
  countdown.append(countdownText, countdownBar);
  container.appendChild(countdown);

  const prompt = document.createElement("h2");
  prompt.textContent = question.prompt;
  container.appendChild(prompt);

  if (question.demo) {
    const specimenContainer = document.createElement("div");
    renderSpecimen(specimenContainer, question.demo);
    container.appendChild(specimenContainer);
  }

  const liveRegion = document.createElement("div");
  liveRegion.className = "sr-live-region";
  liveRegion.setAttribute("aria-live", "polite");
  container.appendChild(liveRegion);

  if (state.screen === "question") {
    renderInput(container, question, callbacks.onAnswer);
  } else {
    renderFeedback(container, question, lastAnswer, liveRegion, callbacks.onNext);
  }
}

function renderInput(container, question, onAnswer) {
  if (question.mode === "choice") {
    const list = document.createElement("div");
    list.className = "choices";
    question.choices.forEach((choiceText, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.dataset.index = String(index);
      const label = document.createElement("span");
      label.className = "choice-label";
      label.textContent = String(index + 1);
      button.append(label, document.createTextNode(choiceText));
      button.addEventListener("click", () => onAnswer(index));
      list.appendChild(button);
    });
    container.appendChild(list);
    // Keys 1-4 are handled by a single app-lifetime listener in main.js, not here,
    // so repeated renders across a round never leak duplicate document listeners.
  } else {
    const form = document.createElement("form");
    form.className = "text-answer-form";
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.autofocus = true;
    input.placeholder = "Type the element name…";
    input.setAttribute("aria-label", "Your answer");
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Submit";
    form.append(input, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onAnswer(input.value);
    });
    container.appendChild(form);
    queueMicrotask(() => input.focus());
  }
}

function renderFeedback(container, question, lastAnswer, liveRegion, onNext) {
  const result = document.createElement("p");
  result.className = lastAnswer.correct ? "feedback-correct" : "feedback-incorrect";
  const verdict = lastAnswer.timedOut ? "Time's up!" : lastAnswer.correct ? "Correct!" : "Not quite.";
  result.textContent = `${verdict} ${lastAnswer.correct ? `+${lastAnswer.points} points` : ""}`;
  container.appendChild(result);
  liveRegion.textContent = verdict;

  if (question.mode === "choice") {
    const answerText = document.createElement("p");
    answerText.textContent = `Correct answer: ${question.choices[question.answerIndex]}`;
    container.appendChild(answerText);
  } else {
    const answerText = document.createElement("p");
    answerText.textContent = `Correct answer: ${question.acceptedAnswers[0]}`;
    container.appendChild(answerText);
  }

  const explanation = document.createElement("p");
  explanation.className = "explanation";
  explanation.textContent = question.explanation;
  container.appendChild(explanation);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "primary-button";
  nextButton.textContent = "Next";
  nextButton.addEventListener("click", onNext);
  container.appendChild(nextButton);
  queueMicrotask(() => nextButton.focus());
  // Enter-to-advance is handled by the single app-lifetime listener in main.js.
}

/** Updates the on-screen countdown without a full re-render (called on every Timer tick). */
export function updateCountdown(remainingMs, totalMs) {
  const text = document.getElementById("countdown-text");
  const bar = document.getElementById("countdown-bar");
  if (!text || !bar) return;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  text.textContent = `0:${String(secondsLeft).padStart(2, "0")} left`;
  bar.style.width = `${Math.max(0, (remainingMs / totalMs) * 100)}%`;
  if (secondsLeft === 10 || secondsLeft === 5 || secondsLeft === 0) {
    const liveRegion = document.querySelector(".sr-live-region");
    if (liveRegion) liveRegion.textContent = `${secondsLeft} seconds left`;
  }
}
