import { elements } from "../../../shared/data/elements.js";
import { QuizState } from "./state.js";
import { Timer } from "./timer.js";
import { renderQuestionScreen, updateCountdown } from "./ui/questionScreen.js";
import { renderResultsScreen } from "./ui/resultsScreen.js";
import { renderStartScreen } from "./ui/startScreen.js";

const app = document.getElementById("app");
const quiz = new QuizState(elements);
let timer = null;

function stopTimer() {
  if (timer) {
    timer.stop();
    timer = null;
  }
}

function startTimerForQuestion(totalMs) {
  stopTimer();
  timer = new Timer({
    durationMs: totalMs,
    onTick: (remaining) => updateCountdown(remaining, totalMs),
    onTimeout: () => quiz.timeout(),
  });
  timer.start();
}

function render(state) {
  app.textContent = "";
  if (state.screen === "start") {
    stopTimer();
    renderStartScreen(app, (settings) => quiz.play(settings));
  } else if (state.screen === "question") {
    renderQuestionScreen(app, state, {
      onAnswer: (response) => {
        stopTimer();
        quiz.answer(response);
      },
      onNext: () => quiz.next(),
    });
    startTimerForQuestion(state.settings.timerSeconds * 1000);
  } else if (state.screen === "feedback") {
    stopTimer();
    renderQuestionScreen(app, state, { onAnswer: () => {}, onNext: () => quiz.next() });
  } else if (state.screen === "results") {
    stopTimer();
    renderResultsScreen(app, state, () => quiz.playAgain());
  }
}

quiz.onChange(render);
render(quiz.state);

// A single app-lifetime keyboard listener, so repeated re-renders across a whole
// round never leak duplicate document-level listeners (see ui/questionScreen.js).
document.addEventListener("keydown", (event) => {
  const state = quiz.state;
  if (state.screen === "question") {
    const question = state.questions[state.currentIndex];
    if (question.mode === "choice") {
      const num = Number.parseInt(event.key, 10);
      if (num >= 1 && num <= question.choices.length) {
        stopTimer();
        quiz.answer(num - 1);
      }
    }
  } else if (state.screen === "feedback" && event.key === "Enter") {
    quiz.next();
  }
});
