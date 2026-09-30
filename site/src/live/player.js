import { gameSocketUrl, LiveSocket } from "./socket.js";

function sessionKey(pin) {
  return `elements-quiz:live:player-session:${pin}`;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
}

export function initPlayerScreen(container) {
  const pin = new URLSearchParams(location.search).get("pin") ?? "";
  renderJoin(container, pin);
}

function renderJoin(container, initialPin) {
  container.textContent = "";
  container.appendChild(el("h1", { textContent: "Join a Live Game" }));

  const form = el("form", { className: "start-form" });
  const pinInput = el("input", {
    type: "text",
    name: "pin",
    inputMode: "numeric",
    pattern: "\\d{6}",
    maxLength: 6,
    placeholder: "6-digit PIN",
    value: initialPin,
    required: true,
  });
  const nicknameInput = el("input", {
    type: "text",
    name: "nickname",
    maxLength: 20,
    placeholder: "Your nickname",
    required: true,
    autocomplete: "off",
  });
  const submit = el("button", { type: "submit", className: "primary-button", textContent: "Join" });
  const errorMessage = el("p", { className: "feedback-incorrect" });
  form.append(pinInput, nicknameInput, submit, errorMessage);
  container.appendChild(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const pin = pinInput.value.trim();
    const nickname = nicknameInput.value.trim();
    if (!/^\d{6}$/.test(pin) || !nickname) {
      errorMessage.textContent = "Enter a valid 6-digit PIN and a nickname.";
      return;
    }
    renderGame(container, pin, nickname);
  });
}

function renderGame(container, pin, nickname) {
  container.textContent = "";
  const status = el("p", { className: "connection-status" });
  const body = el("div", { className: "live-body" });
  container.append(status, body);

  const socket = new LiveSocket(gameSocketUrl(pin));
  let countdownInterval = null;

  const stopCountdown = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  };

  socket.onStatusChange((s) => {
    status.textContent = s === "connected" ? "Connected" : s === "connecting" ? "Connecting…" : "Reconnecting…";
  });

  socket.on("joined", ({ playerId, playerToken }) => {
    sessionStorage.setItem(sessionKey(pin), JSON.stringify({ playerId, playerToken }));
  });

  socket.on("lobby", () => {
    stopCountdown();
    body.textContent = "";
    body.appendChild(el("h2", { textContent: "Waiting for the host to start…" }));
  });

  socket.on("question", (message) => {
    stopCountdown();
    renderPlayerQuestion(body, message, socket, (remainingMs) => {
      const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
      const countdownEl = body.querySelector(".countdown-text");
      if (countdownEl) countdownEl.textContent = `0:${String(secondsLeft).padStart(2, "0")}`;
    });
    countdownInterval = setInterval(() => {
      const remaining = message.endsAt - socket.serverNow();
      const countdownEl = body.querySelector(".countdown-text");
      if (countdownEl) countdownEl.textContent = `0:${String(Math.max(0, Math.ceil(remaining / 1000))).padStart(2, "0")}`;
      if (remaining <= 0) stopCountdown();
    }, 200);
  });

  socket.on("reveal", (message) => {
    stopCountdown();
    body.textContent = "";
    const verdict = message.yourResult?.correct ? "Correct!" : "Not quite.";
    body.appendChild(el("h2", { textContent: verdict }));
    if (message.yourResult?.correct) {
      body.appendChild(el("p", { textContent: `+${message.yourResult.points} points` }));
    }
    body.appendChild(el("p", { textContent: `Correct answer: ${message.correctAnswer}` }));
    body.appendChild(el("p", { className: "explanation", textContent: message.explanation }));
  });

  socket.on("leaderboard", ({ top }) => renderStandings(body, top, "Leaderboard"));
  socket.on("podium", ({ top }) => {
    renderStandings(body, top, "Final Results");
    sessionStorage.removeItem(sessionKey(pin));
  });

  socket.on("error", ({ code }) => {
    if (code === "NAME_TAKEN") {
      body.textContent = "";
      body.appendChild(el("p", { className: "feedback-incorrect", textContent: "That nickname is taken. Please rejoin with another." }));
    }
  });

  socket.connect(() => {
    const saved = sessionStorage.getItem(sessionKey(pin));
    if (saved) {
      const { playerToken } = JSON.parse(saved);
      socket.send("player.resume", { playerToken });
    } else {
      socket.send("player.join", { nickname });
    }
  });
}

function renderPlayerQuestion(body, message, socket, onTick) {
  body.textContent = "";
  body.appendChild(el("p", { className: "countdown-text", textContent: "" }));
  body.appendChild(el("h2", { textContent: message.prompt }));
  onTick(message.endsAt - socket.serverNow());

  let answered = false;
  if (message.mode === "choice") {
    const list = el("div", { className: "choices" });
    message.choices.forEach((choiceText, index) => {
      const button = el("button", { type: "button", className: "choice-button", textContent: `${index + 1}. ${choiceText}` });
      button.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        socket.send("player.answer", { questionId: message.id, choice: index });
        body.appendChild(el("p", { textContent: "Answer submitted, waiting for results…" }));
        for (const btn of list.querySelectorAll("button")) btn.disabled = true;
      });
      list.appendChild(button);
    });
    body.appendChild(list);
  } else {
    const form = el("form", { className: "text-answer-form" });
    const input = el("input", { type: "text", autocomplete: "off", placeholder: "Type the element name…" });
    const submit = el("button", { type: "submit", textContent: "Submit" });
    form.append(input, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (answered) return;
      answered = true;
      socket.send("player.answer", { questionId: message.id, text: input.value });
      form.replaceWith(el("p", { textContent: "Answer submitted, waiting for results…" }));
    });
    body.appendChild(form);
  }
}

function renderStandings(body, top, heading) {
  body.textContent = "";
  body.appendChild(el("h2", { textContent: heading }));
  const list = el("ol");
  for (const player of top) list.appendChild(el("li", { textContent: `${player.nickname} — ${player.score}` }));
  body.appendChild(list);
}
