import { DurableObject } from "cloudflare:workers";
import { isCorrectTypedAnswer } from "../../shared/answerMatch.js";
import { encodeServerMessage, parseClientMessage } from "../../shared/protocol.js";
import { buildRound } from "../../shared/quiz.js";
import { scoreAnswer } from "../../shared/scoring.js";

const MAX_PLAYERS = 100;
const ANSWER_GRACE_MS = 500;
const IDLE_CLOSE_MS = 60 * 60 * 1000; // 1 hour
const STATE_KEY = "state";

const PHASES = Object.freeze({
  LOBBY: "lobby",
  QUESTION: "question",
  REVEAL: "reveal",
  LEADERBOARD: "leaderboard",
  PODIUM: "podium",
  CLOSED: "closed",
});

function nowIso() {
  return new Date().toISOString();
}

/**
 * One GameRoom Durable Object instance per Live game (PLAN.md §7). Uses the WebSocket
 * Hibernation API so idle lobbies don't bill for connection duration, and Durable Object
 * storage (not memory) as the source of truth so game state survives hibernation.
 */
export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  // ---- HTTP entry points (called by worker/index.js) -----------------------------------

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      return this.#handleInit(request);
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected a WebSocket upgrade", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async #handleInit(request) {
    const existing = await this.ctx.storage.get(STATE_KEY);
    if (existing) {
      return Response.json({ ok: false, error: "ALREADY_INITIALIZED" }, { status: 409 });
    }
    const { pin, hostToken, level, questionCount, timerSeconds, elements } = await request.json();
    const questions = buildRound({ elements, level, count: questionCount });
    const state = {
      phase: PHASES.LOBBY,
      pin,
      hostToken,
      level,
      timerSeconds,
      questions,
      currentIndex: -1,
      questionOpenedAt: null,
      players: {},
      answers: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await this.ctx.storage.put(STATE_KEY, state);
    await this.#scheduleIdleCleanup();
    return Response.json({ ok: true });
  }

  // ---- WebSocket Hibernation API callbacks ---------------------------------------------

  async webSocketMessage(ws, raw) {
    const result = parseClientMessage(raw);
    if (!result.ok) {
      this.#send(ws, "error", { code: result.error });
      return;
    }

    const state = await this.ctx.storage.get(STATE_KEY);
    if (!state || state.phase === PHASES.CLOSED) {
      this.#send(ws, "error", { code: "GAME_CLOSED" });
      return;
    }

    const identity = ws.deserializeAttachment();
    if (!identity) {
      await this.#handleFirstMessage(ws, state, result);
      return;
    }

    if (identity.role === "host") {
      await this.#handleHostMessage(ws, state, result);
    } else {
      await this.#handlePlayerMessage(ws, state, identity, result);
    }
  }

  async webSocketClose(ws) {
    const identity = ws.deserializeAttachment();
    if (!identity || identity.role !== "player") return;
    const state = await this.ctx.storage.get(STATE_KEY);
    if (!state) return;
    const player = state.players[identity.playerId];
    if (player) {
      player.connected = false;
      state.updatedAt = nowIso();
      await this.ctx.storage.put(STATE_KEY, state);
      await this.#broadcastLobby(state);
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  /** Runs on the question timer expiring, OR the idle-cleanup fallback (PLAN.md §7). */
  async alarm() {
    const state = await this.ctx.storage.get(STATE_KEY);
    if (!state) return;

    if (state.phase === PHASES.QUESTION) {
      await this.#reveal(state);
      return;
    }

    // Idle-cleanup alarm: only actually tear the room down if nothing has happened
    // since we scheduled it (a fresh question/host action would have moved the
    // phase along and rescheduled a different alarm already).
    const idleFor = Date.now() - new Date(state.updatedAt).getTime();
    if (idleFor >= IDLE_CLOSE_MS) {
      await this.#closeGame(state);
    } else {
      await this.#scheduleIdleCleanup();
    }
  }

  // ---- First message on a fresh connection: identify host or player --------------------

  async #handleFirstMessage(ws, state, result) {
    const { type, payload } = result;

    if (type === "host.hello") {
      if (payload.hostToken !== state.hostToken) {
        this.#send(ws, "error", { code: "BAD_HOST_TOKEN" });
        ws.close(4401, "bad host token");
        return;
      }
      ws.serializeAttachment({ role: "host" });
      await this.#sendCurrentPhase(ws, state);
      await this.#broadcastLobby(state);
      return;
    }

    if (type === "player.resume") {
      const player = Object.values(state.players).find((p) => p.playerToken === payload.playerToken);
      if (!player) {
        this.#send(ws, "error", { code: "BAD_PLAYER_TOKEN" });
        ws.close(4401, "bad player token");
        return;
      }
      ws.serializeAttachment({ role: "player", playerId: player.id });
      player.connected = true;
      state.updatedAt = nowIso();
      await this.ctx.storage.put(STATE_KEY, state);
      this.#send(ws, "joined", { playerId: player.id, playerToken: player.playerToken });
      await this.#sendCurrentPhase(ws, state);
      await this.#broadcastLobby(state);
      return;
    }

    if (type === "player.join") {
      if (state.phase !== PHASES.LOBBY) {
        this.#send(ws, "error", { code: "NOT_OPEN" });
        ws.close(4400, "game already started");
        return;
      }
      const connectedCount = Object.values(state.players).filter((p) => p.connected).length;
      if (connectedCount >= MAX_PLAYERS) {
        this.#send(ws, "error", { code: "ROOM_FULL" });
        ws.close(4403, "room full");
        return;
      }
      const nicknameTaken = Object.values(state.players).some(
        (p) => p.connected && p.nickname.toLowerCase() === payload.nickname.toLowerCase(),
      );
      if (nicknameTaken) {
        this.#send(ws, "error", { code: "NAME_TAKEN" });
        return;
      }
      const playerId = crypto.randomUUID();
      const playerToken = crypto.randomUUID();
      state.players[playerId] = {
        id: playerId,
        nickname: payload.nickname,
        playerToken,
        score: 0,
        streak: 0,
        connected: true,
      };
      state.updatedAt = nowIso();
      await this.ctx.storage.put(STATE_KEY, state);
      ws.serializeAttachment({ role: "player", playerId });
      this.#send(ws, "joined", { playerId, playerToken });
      await this.#broadcastLobby(state);
      return;
    }

    this.#send(ws, "error", { code: "MUST_IDENTIFY_FIRST" });
    ws.close(4400, "expected host.hello, player.join, or player.resume");
  }

  // ---- Host-authored actions -------------------------------------------------------------

  async #handleHostMessage(ws, state, result) {
    const { type, payload } = result;
    switch (type) {
      case "host.start":
        if (state.phase === PHASES.LOBBY) await this.#openQuestion(state, 0);
        break;
      case "host.next":
        if (state.phase === PHASES.REVEAL) {
          await this.#showLeaderboard(state);
        } else if (state.phase === PHASES.LEADERBOARD) {
          const nextIndex = state.currentIndex + 1;
          if (nextIndex < state.questions.length) {
            await this.#openQuestion(state, nextIndex);
          } else {
            await this.#showPodium(state);
          }
        }
        break;
      case "host.skip":
        if (state.phase === PHASES.QUESTION) await this.#reveal(state);
        break;
      case "host.kick":
        await this.#kickPlayer(state, payload.playerId);
        break;
      case "host.end":
        await this.#closeGame(state);
        break;
      default:
        this.#send(ws, "error", { code: "UNKNOWN_TYPE" });
    }
  }

  // ---- Player-authored actions ------------------------------------------------------------

  async #handlePlayerMessage(ws, state, identity, result) {
    const { type, payload } = result;
    if (type !== "player.answer") {
      this.#send(ws, "error", { code: "UNKNOWN_TYPE" });
      return;
    }
    if (state.phase !== PHASES.QUESTION) {
      this.#send(ws, "error", { code: "NOT_OPEN" });
      return;
    }
    const question = state.questions[state.currentIndex];
    if (payload.questionId !== question.id) {
      this.#send(ws, "error", { code: "NOT_OPEN" });
      return;
    }
    const elapsed = Date.now() - new Date(state.questionOpenedAt).getTime();
    const questionTimeMs = state.timerSeconds * 1000;
    if (elapsed > questionTimeMs + ANSWER_GRACE_MS) {
      this.#send(ws, "error", { code: "NOT_OPEN" });
      return;
    }
    const expectsChoice = question.mode === "choice";
    if (expectsChoice !== (payload.choice !== undefined)) {
      this.#send(ws, "error", { code: "BAD_PAYLOAD" });
      return;
    }

    state.answers[question.id] ??= {};
    if (state.answers[question.id][identity.playerId]) {
      return; // one answer per player per question; silently ignore extras
    }

    const correct =
      question.mode === "choice" ? payload.choice === question.answerIndex : isCorrectTypedAnswer(payload.text, question.acceptedAnswers);
    const player = state.players[identity.playerId];
    const { points, streak } = scoreAnswer({
      correct,
      level: state.level,
      responseTimeMs: Math.min(elapsed, questionTimeMs),
      questionTimeMs,
      streakBeforeThisAnswer: player.streak,
    });
    state.answers[question.id][identity.playerId] = {
      correct,
      points,
      submittedAt: nowIso(),
      // Only the choice index is ever persisted for distribution counts; typed Hard
      // answers are never stored raw or broadcast (PLAN.md §8 Live mode).
      choiceIndex: question.mode === "choice" ? payload.choice : undefined,
    };
    player.score += points;
    player.streak = streak;
    state.updatedAt = nowIso();
    await this.ctx.storage.put(STATE_KEY, state);

    this.#sendToHost("answerCount", { answered: Object.keys(state.answers[question.id]).length, total: this.#connectedPlayerCount(state) });

    const allAnswered = Object.keys(state.answers[question.id]).length >= this.#connectedPlayerCount(state);
    if (allAnswered) await this.#reveal(state);
  }

  // ---- Phase transitions -----------------------------------------------------------------

  async #openQuestion(state, index) {
    state.phase = PHASES.QUESTION;
    state.currentIndex = index;
    state.questionOpenedAt = nowIso();
    state.updatedAt = nowIso();
    await this.ctx.storage.put(STATE_KEY, state);
    await this.ctx.storage.setAlarm(Date.now() + state.timerSeconds * 1000 + ANSWER_GRACE_MS);

    const question = state.questions[index];
    const publicQuestion = {
      id: question.id,
      mode: question.mode,
      prompt: question.prompt,
      choices: question.choices,
      demo: question.demo,
    };
    const serverNow = Date.now();
    const endsAt = serverNow + state.timerSeconds * 1000;
    this.#broadcast("question", {
      index,
      total: state.questions.length,
      ...publicQuestion,
      endsAt,
      serverNow,
    });
  }

  async #reveal(state) {
    if (state.phase !== PHASES.QUESTION) return; // already revealed (e.g. alarm fired after host.skip)
    const question = state.questions[state.currentIndex];
    const answers = state.answers[question.id] ?? {};

    // Anyone connected who didn't answer in time scores zero and their streak resets.
    for (const player of Object.values(state.players)) {
      if (player.connected && !answers[player.id]) {
        player.streak = 0;
      }
    }

    state.phase = PHASES.REVEAL;
    state.updatedAt = nowIso();
    await this.ctx.storage.put(STATE_KEY, state);

    const distribution =
      question.mode === "choice"
        ? question.choices.map((_, i) => Object.values(answers).filter((a) => a.choiceIndex === i).length)
        : undefined;
    const correctAnswer = question.mode === "choice" ? question.choices[question.answerIndex] : question.acceptedAnswers[0];

    this.#broadcastToAllExceptHost("reveal", {
      correctAnswer,
      explanation: question.explanation,
      distribution,
    });
    for (const [playerId, ws] of this.#playerSockets()) {
      const result = answers[playerId];
      this.#send(ws, "reveal", {
        correctAnswer,
        explanation: question.explanation,
        distribution,
        yourResult: result ? { correct: result.correct, points: result.points } : { correct: false, points: 0 },
      });
    }
    this.#sendToHost("reveal", { correctAnswer, explanation: question.explanation, distribution });
  }

  async #showLeaderboard(state) {
    state.phase = PHASES.LEADERBOARD;
    state.updatedAt = nowIso();
    await this.ctx.storage.put(STATE_KEY, state);
    this.#broadcast("leaderboard", { top: this.#topPlayers(state, 5) });
  }

  async #showPodium(state) {
    state.phase = PHASES.PODIUM;
    state.updatedAt = nowIso();
    await this.ctx.storage.put(STATE_KEY, state);
    await this.#scheduleIdleCleanup();
    this.#broadcast("podium", { top: this.#topPlayers(state, 3) });
  }

  async #kickPlayer(state, playerId) {
    const player = state.players[playerId];
    if (!player) return;
    for (const ws of this.ctx.getWebSockets()) {
      const identity = ws.deserializeAttachment();
      if (identity?.role === "player" && identity.playerId === playerId) {
        this.#send(ws, "error", { code: "KICKED" });
        ws.close(4403, "kicked");
      }
    }
    delete state.players[playerId];
    state.updatedAt = nowIso();
    await this.ctx.storage.put(STATE_KEY, state);
    await this.#broadcastLobby(state);
  }

  async #closeGame(state) {
    state.phase = PHASES.CLOSED;
    await this.ctx.storage.put(STATE_KEY, state);
    for (const ws of this.ctx.getWebSockets()) {
      ws.close(4000, "game ended");
    }
    await this.ctx.storage.deleteAll();
  }

  async #scheduleIdleCleanup() {
    await this.ctx.storage.setAlarm(Date.now() + IDLE_CLOSE_MS);
  }

  // ---- Broadcast helpers ------------------------------------------------------------------

  #send(ws, type, payload) {
    try {
      ws.send(encodeServerMessage(type, payload));
    } catch {
      // Socket may already be closing; nothing to do.
    }
  }

  #sendToHost(type, payload) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.deserializeAttachment()?.role === "host") this.#send(ws, type, payload);
    }
  }

  #broadcast(type, payload) {
    for (const ws of this.ctx.getWebSockets()) this.#send(ws, type, payload);
  }

  #broadcastToAllExceptHost(type, payload) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.deserializeAttachment()?.role !== "host") this.#send(ws, type, payload);
    }
  }

  *#playerSockets() {
    for (const ws of this.ctx.getWebSockets()) {
      const identity = ws.deserializeAttachment();
      if (identity?.role === "player") yield [identity.playerId, ws];
    }
  }

  #connectedPlayerCount(state) {
    return Object.values(state.players).filter((p) => p.connected).length;
  }

  #topPlayers(state, count) {
    return Object.values(state.players)
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((p) => ({ nickname: p.nickname, score: p.score }));
  }

  async #broadcastLobby(state) {
    const players = Object.values(state.players)
      .filter((p) => p.connected)
      .map((p) => p.nickname);
    this.#broadcast("lobby", { players, count: players.length });
  }

  async #sendCurrentPhase(ws, state) {
    if (state.phase === PHASES.QUESTION) {
      const question = state.questions[state.currentIndex];
      const endsAt = new Date(state.questionOpenedAt).getTime() + state.timerSeconds * 1000;
      this.#send(ws, "question", {
        index: state.currentIndex,
        total: state.questions.length,
        id: question.id,
        mode: question.mode,
        prompt: question.prompt,
        choices: question.choices,
        demo: question.demo,
        endsAt,
        serverNow: Date.now(),
      });
    } else if (state.phase === PHASES.REVEAL) {
      const question = state.questions[state.currentIndex];
      const correctAnswer = question.mode === "choice" ? question.choices[question.answerIndex] : question.acceptedAnswers[0];
      this.#send(ws, "reveal", { correctAnswer, explanation: question.explanation });
    } else if (state.phase === PHASES.LEADERBOARD) {
      this.#send(ws, "leaderboard", { top: this.#topPlayers(state, 5) });
    } else if (state.phase === PHASES.PODIUM) {
      this.#send(ws, "podium", { top: this.#topPlayers(state, 3) });
    }
  }
}
