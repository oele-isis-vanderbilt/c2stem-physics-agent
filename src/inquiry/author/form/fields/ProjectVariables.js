import { NetsBloxSim, projectUrl } from "../../../player/sim/netsblox";

// Projects read this session, so the list survives moving around the form
const loaded = new Map();
const cacheKey = ({ source, owner, project }) =>
  [source, owner, project].join("|");

/** The globals read earlier this session for this project, or null. */
export function cachedGlobals(sim) {
  return loaded.get(cacheKey(sim)) || null;
}

/**
 * Opens a physics project out of sight, with the same adapter the player
 * uses, and reads its global variables.
 *
 * Returns { done, cancel }: `done` resolves with { name: value }, where a
 * list variable's value is an array of rows.
 */
export function loadProjectGlobals({ source, owner, project }) {
  const sim = {
    source,
    owner,
    project,
    inputs: {},
    outputs: {},
    done: { mode: "poll" },
  };
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.title = "Project being read";
  // In the window but invisible: browsers pause frames that are hidden or
  // off screen, and the project would never load
  Object.assign(frame.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "480px",
    height: "360px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
  });
  frame.src = projectUrl(sim);
  document.body.appendChild(frame);
  const adapter = new NetsBloxSim(frame, sim);

  const close = () => {
    adapter.destroy();
    frame.remove();
  };
  const done = (async () => {
    try {
      await adapter.ready();
      const globals = await adapter.globals();
      loaded.set(cacheKey(sim), globals);
      return globals;
    } finally {
      close();
    }
  })();
  return { done, cancel: close };
}

/** A project value as short text: 2.5, "go", or a list of 40 rows. */
export function describeValue(value) {
  if (Array.isArray(value)) {
    return `list of ${value.length} row${value.length === 1 ? "" : "s"}`;
  }
  if (value === undefined || value === null || value === "") return "empty";
  if (typeof value === "number") return String(Math.round(value * 1000) / 1000);
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 24 ? `${text.slice(0, 23)}…` : text;
}
