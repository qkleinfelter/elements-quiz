import { isCorrectTypedAnswer } from "../../../shared/answerMatch.js";
import { buildRound } from "../../../shared/quiz.js";
import { scoreAnswer } from "../../../shared/scoring.js";
import { maybeSaveHighScore } from "./storage.js";

/**
 * Solo quiz state machine (PLAN.md §6). Pure logic, no DOM access, so it can be unit
 * tested directly. UI modules call the methods below and subscribe via `onChange` to
 * re-render after each transition.
 *
 *   start -> question -> feedback -> question (more) | results -> start
 */
export class QuizState {
  #elements;
  #listeners = new Set();
  #state;

  constructor(elements) {
    this.#elements = elements;
    this.#state = { screen: "start" };
  }

  get state() {
    return this.#state;
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #setState(next) {
    this.#state = next;
    for (const listener of this.#listeners) listener(this.#state);
  }

  /** Starts a new round. `settings` is `{ level, count, timerSeconds }`. */
  play(settings, random = Math.random) {
    const questions = buildRound({ elements: this.#elements, level: settings.level, count: settings.count, random });
    this.#setState({
      screen: "question",
      settings,
      questions,
      currentIndex: 0,
      score: 0,
      streak: 0,
      answers: [],
      questionStartedAt: Date.now(),
    });
  }

  #currentQuestion() {
    if (this.#state.screen !== "question" && this.#state.screen !== "feedback") return null;
    return this.#state.questions[this.#state.currentIndex];
  }

  /** Answers the current question. `response` is a choice index (number) or typed text (string). */
  answer(response) {
    const question = this.#currentQuestion();
    if (!question || this.#state.screen !== "question") return;

    const correct =
      question.mode === "choice" ? response === question.answerIndex : isCorrectTypedAnswer(response, question.acceptedAnswers);
    this.#recordAnswer({ question, correct, response, timedOut: false });
  }

  /** Called when the per-question timer reaches zero with no answer submitted. */
  timeout() {
    const question = this.#currentQuestion();
    if (!question || this.#state.screen !== "question") return;
    this.#recordAnswer({ question, correct: false, response: null, timedOut: true });
  }

  #recordAnswer({ question, correct, response, timedOut }) {
    const responseTimeMs = Date.now() - this.#state.questionStartedAt;
    const questionTimeMs = this.#state.settings.timerSeconds * 1000;
    const { points, streak } = scoreAnswer({
      correct,
      level: this.#state.settings.level,
      responseTimeMs,
      questionTimeMs,
      streakBeforeThisAnswer: this.#state.streak,
    });
    const answers = [...this.#state.answers, { question, correct, response, timedOut, points }];
    this.#setState({ ...this.#state, screen: "feedback", score: this.#state.score + points, streak, answers });
  }

  /** Advances from feedback to the next question, or to results if the round is over. */
  next() {
    if (this.#state.screen !== "feedback") return;
    const nextIndex = this.#state.currentIndex + 1;
    if (nextIndex >= this.#state.questions.length) {
      const highScore = maybeSaveHighScore(this.#state.settings.level, this.#state.score);
      this.#setState({ ...this.#state, screen: "results", highScore });
      return;
    }
    this.#setState({ ...this.#state, screen: "question", currentIndex: nextIndex, questionStartedAt: Date.now() });
  }

  /** Returns to the start screen to configure and play again. */
  playAgain() {
    this.#setState({ screen: "start" });
  }
}
