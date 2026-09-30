import { gameSocketUrl, LiveSocket } from "./socket.js";

const HOST_SESSION_KEY = "elements-quiz:live:host-session";

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
}

export function initHostScreen(container) {
  const saved = sessionStorage.getItem(HOST_SESSION_KEY);
  if (saved) {
    const { pin, hostToken } = JSON.parse(saved);
    renderGame(container, pin, hostToken);
  } else {
    renderSetup(container);
  }
}

function renderSetup(container) {
  container.textContent = "";
  container.appendChild(el("h1", { textContent: "Host a Live Game" }));

  const form = el("form", { className: "start-form" });
  const levelField = el("fieldset");
  levelField.appendChild(el("legend", { textContent: "Level" }));
  for (const level of ["easy", "medium", "hard"]) {
    const label = el("label");
    const input = el("input", { type: "radio", name: "level", value: level, checked: level === "easy" });
    label.append(input, ` ${level[0].toUpperCase()}${level.slice(1)}`);
    levelField.appendChild(label);
  }
  form.appendChild(levelField);

  const countField = el("fieldset");
  countField.appendChild(el("legend", { textContent: "Questions" }));
  for (const count of [10, 20, "all"]) {
    const label = el("label");
    const input = el("input", { type: "radio", name: "questionCount", value: String(count), checked: count === 10 });
    label.append(input, ` ${count === "all" ? "All" : count}`);
    countField.appendChild(label);
  }
  form.appendChild(countField);

  const timerField = el("fieldset");
  timerField.appendChild(el("legend", { textContent: "Seconds per question" }));
  const timerInput = el("input", { type: "number", name: "timerSeconds", value: "30", min: "5", max: "120" });
  timerField.appendChild(timerInput);
  form.appendChild(timerField);

  const submit = el("button", { type: "submit", className: "primary-button", textContent: "Create Game" });
  form.appendChild(submit);

  const errorMessage = el("p", { className: "feedback-incorrect" });
  form.appendChild(errorMessage);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    errorMessage.textContent = "";
    const formData = new FormData(form);
    const level = formData.get("level");
    const rawCount = formData.get("questionCount");
    const questionCount = rawCount === "all" ? "all" : Number.parseInt(rawCount, 10);
    const timerSeconds = Number.parseInt(formData.get("timerSeconds"), 10);

    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level, questionCount, timerSeconds }),
      });
      if (!response.ok) throw new Error("Failed to create game");
      const { pin, hostToken } = await response.json();
      sessionStorage.setItem(HOST_SESSION_KEY, JSON.stringify({ pin, hostToken }));
      renderGame(container, pin, hostToken);
    } catch {
      errorMessage.textContent = "Couldn't create a game. Please try again.";
      submit.disabled = false;
    }
  });

  container.appendChild(form);
}

function renderGame(container, pin, hostToken) {
  container.textContent = "";
  const status = el("p", { className: "connection-status" });
  const pinDisplay = el("div", { className: "pin-display" });
  pinDisplay.appendChild(el("p", { textContent: "Join at " }));
  const joinUrl = `${location.origin}/play.html?pin=${pin}`;
  pinDisplay.appendChild(el("a", { href: joinUrl, textContent: joinUrl }));
  pinDisplay.appendChild(el("p", { className: "pin-code", textContent: pin }));

  const body = el("div", { className: "live-body" });
  const controls = el("div", { className: "host-controls" });

  container.append(status, pinDisplay, body, controls);

  const socket = new LiveSocket(gameSocketUrl(pin));
  socket.onStatusChange((s) => {
    status.textContent = s === "connected" ? "Connected" : s === "connecting" ? "Connecting…" : "Reconnecting…";
  });
  socket.on("lobby", ({ players, count }) => renderLobby(body, controls, players, count, socket));
  socket.on("question", (message) => renderHostQuestion(body, controls, message, socket));
  socket.on("answerCount", ({ answered, total }) => {
    const el2 = body.querySelector(".answer-count");
    if (el2) el2.textContent = `${answered} / ${total} answered`;
  });
  socket.on("reveal", (message) => renderHostReveal(body, controls, message, socket));
  socket.on("leaderboard", ({ top }) => renderLeaderboard(body, controls, top, socket, false));
  socket.on("podium", ({ top }) => {
    renderLeaderboard(body, controls, top, socket, true);
    sessionStorage.removeItem(HOST_SESSION_KEY);
  });
  socket.on("error", ({ code }) => {
    status.textContent = `Error: ${code}`;
  });

  socket.connect(() => socket.send("host.hello", { hostToken }));
}

function renderLobby(body, controls, players, count, socket) {
  body.textContent = "";
  body.appendChild(el("h2", { textContent: "Waiting for players…" }));
  body.appendChild(el("p", { textContent: `${count} player${count === 1 ? "" : "s"} joined` }));
  const list = el("ul");
  for (const nickname of players) list.appendChild(el("li", { textContent: nickname }));
  body.appendChild(list);

  controls.textContent = "";
  const startButton = el("button", { type: "button", className: "primary-button", textContent: "Start Game" });
  startButton.addEventListener("click", () => socket.send("host.start"));
  controls.appendChild(startButton);
}

function renderHostQuestion(body, controls, message, socket) {
  body.textContent = "";
  body.appendChild(el("p", { className: "progress", textContent: `Question ${message.index + 1} of ${message.total}` }));
  body.appendChild(el("h2", { textContent: message.prompt }));
  if (message.mode === "choice") {
    const list = el("ol", { className: "host-choices" });
    for (const choice of message.choices) list.appendChild(el("li", { textContent: choice }));
    body.appendChild(list);
  }
  body.appendChild(el("p", { className: "answer-count", textContent: "0 answered" }));

  controls.textContent = "";
  const skipButton = el("button", { type: "button", textContent: "Skip" });
  skipButton.addEventListener("click", () => socket.send("host.skip"));
  controls.appendChild(skipButton);
}

function renderHostReveal(body, controls, message, socket) {
  body.textContent = "";
  body.appendChild(el("h2", { textContent: `Answer: ${message.correctAnswer}` }));
  body.appendChild(el("p", { className: "explanation", textContent: message.explanation }));
  if (message.distribution) {
    const list = el("ul");
    message.distribution.forEach((count, i) => list.appendChild(el("li", { textContent: `Choice ${i + 1}: ${count}` })));
    body.appendChild(list);
  }

  controls.textContent = "";
  const nextButton = el("button", { type: "button", className: "primary-button", textContent: "Next" });
  nextButton.addEventListener("click", () => socket.send("host.next"));
  controls.appendChild(nextButton);
}

function renderLeaderboard(body, controls, top, socket, isFinal) {
  body.textContent = "";
  body.appendChild(el("h2", { textContent: isFinal ? "Final Results" : "Leaderboard" }));
  const list = el("ol");
  for (const player of top) list.appendChild(el("li", { textContent: `${player.nickname} — ${player.score}` }));
  body.appendChild(list);

  controls.textContent = "";
  if (!isFinal) {
    const nextButton = el("button", { type: "button", className: "primary-button", textContent: "Next Question" });
    nextButton.addEventListener("click", () => socket.send("host.next"));
    controls.appendChild(nextButton);
  }
}
