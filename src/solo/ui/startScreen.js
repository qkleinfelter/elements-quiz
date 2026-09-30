import { getHighScore, getSettings, saveSettings } from "../storage.js";

const LEVELS = ["easy", "medium", "hard"];
const QUESTION_COUNTS = [10, 20, "all"];

/** Renders the start screen into `container`. Calls `onPlay(settings)` when the player starts. */
export function renderStartScreen(container, onPlay) {
  container.textContent = "";
  const settings = getSettings();

  const heading = document.createElement("h1");
  heading.textContent = "Tag, You're Obsolete";
  container.appendChild(heading);

  const subheading = document.createElement("p");
  subheading.textContent = "A quiz on obscure, deprecated, and forgotten HTML elements.";
  container.appendChild(subheading);

  const form = document.createElement("form");
  form.className = "start-form";

  form.appendChild(buildLevelPicker(settings.level));
  form.appendChild(buildCountPicker(settings.questionCount));
  form.appendChild(buildHighScores());

  const playButton = document.createElement("button");
  playButton.type = "submit";
  playButton.className = "primary-button";
  playButton.textContent = "Play Solo";
  form.appendChild(playButton);

  const liveLinks = document.createElement("p");
  liveLinks.className = "live-links";
  const hostLink = document.createElement("a");
  hostLink.href = "/host.html";
  hostLink.textContent = "Host a Live Game";
  const joinLink = document.createElement("a");
  joinLink.href = "/play.html";
  joinLink.textContent = "Join a Live Game";
  liveLinks.append(hostLink, " · ", joinLink);
  form.appendChild(liveLinks);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const level = formData.get("level");
    const countValue = formData.get("questionCount");
    const questionCount = countValue === "all" ? "all" : Number.parseInt(countValue, 10);
    const saved = saveSettings({ level, questionCount });
    onPlay({ level: saved.level, count: saved.questionCount, timerSeconds: saved.timerSeconds });
  });

  container.appendChild(form);
}

function buildLevelPicker(selectedLevel) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Level";
  fieldset.appendChild(legend);

  for (const level of LEVELS) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "level";
    input.value = level;
    input.checked = level === selectedLevel;
    label.appendChild(input);
    label.append(` ${capitalize(level)}`);
    fieldset.appendChild(label);
  }
  return fieldset;
}

function buildCountPicker(selectedCount) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Questions";
  fieldset.appendChild(legend);

  for (const count of QUESTION_COUNTS) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "questionCount";
    input.value = String(count);
    input.checked = count === selectedCount;
    label.appendChild(input);
    label.append(` ${count === "all" ? "All" : count}`);
    fieldset.appendChild(label);
  }
  return fieldset;
}

function buildHighScores() {
  const list = document.createElement("ul");
  list.className = "high-scores";
  for (const level of LEVELS) {
    const item = document.createElement("li");
    item.textContent = `${capitalize(level)} high score: ${getHighScore(level)}`;
    list.appendChild(item);
  }
  return list;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
