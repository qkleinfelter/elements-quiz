/**
 * Renders a trusted, hard-coded `demo` markup string (from an element's data record) in a
 * sandboxed, scriptless iframe (PLAN.md §7/§8). This is the only place in the app that
 * renders raw HTML, and it only ever renders developer-authored strings from
 * src/shared/data/elements.js, never user input - so legacy markup like <plaintext> can't
 * break the host page, and there is no script-injection surface.
 */
export function renderSpecimen(container, demoHtml) {
  container.textContent = "";
  if (!demoHtml) return;

  const prefersReducedMotion =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    const note = document.createElement("p");
    note.className = "specimen-reduced-motion-note";
    note.textContent = "A live demo is hidden because you prefer reduced motion.";
    container.appendChild(note);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.className = "specimen-frame";
  iframe.setAttribute("sandbox", ""); // no allow-scripts, no allow-same-origin: fully locked down
  iframe.setAttribute("title", "Rendered HTML specimen");
  iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font: 16px/1.4 system-ui, sans-serif; margin: 0.5rem; }
  </style></head><body>${demoHtml}</body></html>`;
  container.appendChild(iframe);
}
