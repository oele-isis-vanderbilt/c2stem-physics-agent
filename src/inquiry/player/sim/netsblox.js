/**
 * Runs a physics project in an iframe through the NetsBlox embed messages
 * (initializeEmbeddedAPI in the physics site's gui-ext.js).
 *
 * It posts the messages itself instead of using embedded-api.js, so a
 * browser holding an old cached copy of that script still sends the run
 * variables.
 *
 * The project rule: every input and output is a global variable, and the
 * green flag reads the inputs without setting them. A run is finished when
 * the done variable (default `time`) stops changing, or equals done.value
 * in "variable" mode.
 */

const REPLY_TIMEOUT_MS = 5000;
const LOAD_TIMEOUT_MS = 45000;
const RUN_TIMEOUT_MS = 30000;
const POLL_MS = 250;
const SETTLE_MS = 1500; // "poll" mode: unchanged this long means finished
const MAX_POINTS = 200; // per run, so saved answers stay small

// Set on the done variable before each run, so a value left over from the
// previous run is never taken for this run's result
const NOT_STARTED = "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The iframe address of the lesson's project. */
export function projectUrl(sim) {
  const base = sim.source.replace(/\/+$/, "");
  const owner = encodeURIComponent(sim.owner);
  const project = encodeURIComponent(sim.project);
  return (
    `${base}/?action=present&Username=${owner}&ProjectName=${project}` +
    "&embedModeNoFlag&noExitWarning&noRun"
  );
}

/** A NetsBlox list (array or linked) as a plain array, rows included. */
function plain(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(plain);
  if (Array.isArray(value.contents)) return value.contents.map(plain);
  if ("first" in value && "rest" in value) {
    const items = [];
    for (let node = value; node && "first" in node; node = node.rest) {
      items.push(plain(node.first));
    }
    return items;
  }
  return value;
}

function toNumber(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

/** Every nth row, so a long run keeps at most MAX_POINTS (and its last row). */
function thin(rows) {
  if (rows.length <= MAX_POINTS) return rows;
  const every = Math.ceil(rows.length / MAX_POINTS);
  const kept = rows.filter((_, i) => i % every === 0);
  if (kept[kept.length - 1] !== rows[rows.length - 1]) {
    kept.push(rows[rows.length - 1]);
  }
  return kept;
}

export class NetsBloxSim {
  /** `sim` is the lesson's simulation config. */
  constructor(iframe, sim) {
    this.iframe = iframe;
    this.sim = sim;
    this.origin = new URL(sim.source).origin;
    this.requests = {};
    this.lastId = 0;
    this.closed = false;
    this.receive = this.receive.bind(this);
    window.addEventListener("message", this.receive);
  }

  destroy() {
    this.closed = true;
    window.removeEventListener("message", this.receive);
    Object.values(this.requests).forEach((r) => r.reject(new Error("closed")));
    this.requests = {};
  }

  receive(event) {
    if (event.origin !== this.origin) return;
    if (event.source !== this.iframe.contentWindow) return;
    const data = event.data || {};
    const request = data.type === "reply" && this.requests[data.id];
    if (request) {
      delete this.requests[data.id];
      clearTimeout(request.timer);
      request.resolve(data);
    }
  }

  post(message) {
    this.iframe.contentWindow.postMessage(message, this.origin);
  }

  request(message, timeoutMs = REPLY_TIMEOUT_MS) {
    const id = `inquiry-${++this.lastId}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        delete this.requests[id];
        reject(new Error("The simulation didn't answer"));
      }, timeoutMs);
      this.requests[id] = { resolve, reject, timer };
      this.post({ ...message, id });
    });
  }

  /** The project's global variables as { name: value }. */
  async globals(timeoutMs) {
    const { variables } = await this.request(
      { type: "global-variables" },
      timeoutMs
    );
    const vars = (variables && variables.vars) || {};
    return Object.fromEntries(
      Object.entries(vars).map(([name, v]) => [name, plain(v && v.value)])
    );
  }

  /**
   * Waits for the project to load. Resolves with the mapped variable names
   * the project doesn't have, so the block can say which sliders do nothing.
   */
  async ready() {
    const deadline = Date.now() + LOAD_TIMEOUT_MS;
    while (!this.closed) {
      // Short waits: messages sent before the project page loads are lost
      const vars = await this.globals(1000).catch(() => ({}));
      if (Object.keys(vars).length) return this.missing(vars);
      if (Date.now() > deadline) {
        throw new Error("The simulation didn't load");
      }
      await sleep(POLL_MS);
    }
    throw new Error("closed");
  }

  missing(vars) {
    const { inputs, outputs, timeSeries } = this.sim;
    const names = [
      ...Object.values(inputs),
      ...Object.values(outputs),
      this.doneVariable(),
      ...(timeSeries ? [timeSeries.variable] : []),
    ];
    return [...new Set(names)].filter((name) => !(name in vars));
  }

  doneVariable() {
    return this.sim.done.variable || "time";
  }

  /**
   * Runs the project with inputs { lessonKey: number } and resolves with
   * { outputs: { lessonKey: number }, series: [{ time, ... }] }.
   */
  async run(inputs) {
    const { done } = this.sim;
    const doneVar = this.doneVariable();
    const variables = { [doneVar]: NOT_STARTED };
    for (const [key, name] of Object.entries(this.sim.inputs)) {
      if (key in inputs) variables[name] = inputs[key];
    }
    this.post({ type: "run-script", variables });

    const deadline = Date.now() + (done.timeoutMs || RUN_TIMEOUT_MS);
    let last;
    let since = Date.now();
    while (!this.closed) {
      await sleep(POLL_MS);
      const vars = await this.globals();
      const now = vars[doneVar];
      const finished =
        done.mode === "variable"
          ? String(now) === String(done.value)
          : now !== NOT_STARTED &&
            String(now) === String(last) &&
            Date.now() - since >= SETTLE_MS;
      if (finished) return this.result(vars);
      if (String(now) !== String(last)) {
        last = now;
        since = Date.now();
      }
      if (Date.now() > deadline) {
        throw new Error("The simulation didn't finish in time");
      }
    }
    throw new Error("closed");
  }

  result(vars) {
    const outputs = {};
    for (const [key, name] of Object.entries(this.sim.outputs)) {
      outputs[key] = toNumber(vars[name]);
    }
    let series = [];
    const { timeSeries } = this.sim;
    if (timeSeries && Array.isArray(vars[timeSeries.variable])) {
      series = thin(
        vars[timeSeries.variable]
          .filter(Array.isArray)
          .map((row) =>
            Object.fromEntries(
              timeSeries.columns.map((col, i) => [col, toNumber(row[i])])
            )
          )
      );
    }
    return { outputs, series };
  }
}
