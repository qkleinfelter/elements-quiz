import { beforeEach, describe, expect, it, vi } from "vitest";
import { elements } from "../../shared/data/elements.js";
import { QuizState } from "../../site/src/solo/state.js";

// storage.js falls back to an in-memory Map when localStorage is unavailable (as in
// plain vitest/node), so high scores persist across calls within a single test run
// but not across files - good enough here since each test constructs a fresh QuizState.

describe("QuizState", () => {
  let quiz;

  beforeEach(() => {
    quiz = new QuizState(elements);
  });

  it("starts on the start screen", () => {
    expect(quiz.state.screen).toBe("start");
  });

  it("play() builds a round and moves to the question screen", () => {
    quiz.play({ level: "easy", count: 5, timerSeconds: 30 });
    expect(quiz.state.screen).toBe("question");
    expect(quiz.state.questions).toHaveLength(5);
    expect(quiz.state.currentIndex).toBe(0);
    expect(quiz.state.score).toBe(0);
  });

  it("answer() with a correct choice moves to feedback and awards points", () => {
    quiz.play({ level: "easy", count: 3, timerSeconds: 30 });
    const question = quiz.state.questions[0];
    quiz.answer(question.answerIndex);
    expect(quiz.state.screen).toBe("feedback");
    expect(quiz.state.answers[0].correct).toBe(true);
    expect(quiz.state.score).toBeGreaterThan(0);
  });

  it("answer() with an incorrect choice awards no points and resets streak", () => {
    quiz.play({ level: "easy", count: 3, timerSeconds: 30 });
    const question = quiz.state.questions[0];
    const wrongIndex = (question.answerIndex + 1) % question.choices.length;
    quiz.answer(wrongIndex);
    expect(quiz.state.answers[0].correct).toBe(false);
    expect(quiz.state.score).toBe(0);
    expect(quiz.state.streak).toBe(0);
  });

  it("timeout() records an incorrect, timed-out answer", () => {
    quiz.play({ level: "easy", count: 3, timerSeconds: 30 });
    quiz.timeout();
    expect(quiz.state.screen).toBe("feedback");
    expect(quiz.state.answers[0].correct).toBe(false);
    expect(quiz.state.answers[0].timedOut).toBe(true);
  });

  it("next() advances to the next question while questions remain", () => {
    quiz.play({ level: "easy", count: 3, timerSeconds: 30 });
    quiz.answer(quiz.state.questions[0].answerIndex);
    quiz.next();
    expect(quiz.state.screen).toBe("question");
    expect(quiz.state.currentIndex).toBe(1);
  });

  it("next() moves to results after the last question", () => {
    quiz.play({ level: "easy", count: 2, timerSeconds: 30 });
    quiz.answer(quiz.state.questions[0].answerIndex);
    quiz.next();
    quiz.answer(quiz.state.questions[1].answerIndex);
    quiz.next();
    expect(quiz.state.screen).toBe("results");
    expect(quiz.state.answers).toHaveLength(2);
    expect(typeof quiz.state.highScore).toBe("number");
  });

  it("playAgain() returns to the start screen", () => {
    quiz.play({ level: "easy", count: 1, timerSeconds: 30 });
    quiz.answer(quiz.state.questions[0].answerIndex);
    quiz.next();
    quiz.playAgain();
    expect(quiz.state.screen).toBe("start");
  });

  it("ignores answer() calls when not on the question screen", () => {
    quiz.play({ level: "easy", count: 1, timerSeconds: 30 });
    quiz.answer(quiz.state.questions[0].answerIndex);
    const scoreAfterFirstAnswer = quiz.state.score;
    quiz.answer(0); // already on feedback screen; should be a no-op
    expect(quiz.state.score).toBe(scoreAfterFirstAnswer);
    expect(quiz.state.answers).toHaveLength(1);
  });

  it("notifies onChange listeners on every transition", () => {
    const listener = vi.fn();
    quiz.onChange(listener);
    quiz.play({ level: "easy", count: 1, timerSeconds: 30 });
    quiz.answer(quiz.state.questions[0].answerIndex);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("supports typed-answer questions on hard level", () => {
    quiz.play({ level: "hard", count: 1, timerSeconds: 30 });
    const question = quiz.state.questions[0];
    expect(question.mode).toBe("text");
    quiz.answer(question.acceptedAnswers[0]);
    expect(quiz.state.answers[0].correct).toBe(true);
  });
});
