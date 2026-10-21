/**
 * One-line descriptions of research events for the logs dashboard. Plain
 * functions; `content` is the lesson version the event came from, or null
 * while it loads (the lines then use ids instead of names).
 */

export const EVENT_TYPES = [
  "lesson_open",
  "step_view",
  "answer",
  "sim_run",
  "sim_error",
  "dialog_open",
  "graph_change",
  "lesson_complete",
  "lesson_exit",
];

const MAX_TEXT = 80;

function short(text) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT - 1)}…` : flat;
}

const quoted = (text) => `“${short(text)}”`;

function blocksOf(content) {
  if (!content || !Array.isArray(content.pages)) return [];
  return content.pages.flatMap((page) =>
    (page.steps || []).flatMap((step) => step.blocks || [])
  );
}

function blockOf(content, blockId) {
  return blocksOf(content).find((block) => block.id === blockId) || null;
}

function number(value) {
  return typeof value === "number"
    ? String(Math.round(value * 1000) / 1000)
    : String(value);
}

/** "5. Investigation · step 2", from the page and step ids. */
export function placeOf(event, content) {
  if (!event.pageId) return "";
  const pages = (content && content.pages) || [];
  const p = pages.findIndex((page) => page.id === event.pageId);
  if (p < 0) return event.pageId;
  const page = pages[p];
  const steps = page.steps || [];
  const s = steps.findIndex((step) => step.id === event.stepId);
  const step = steps.length > 1 && s >= 0 ? ` · step ${s + 1}` : "";
  return `${p + 1}. ${page.title || page.phase}${step}`;
}

/** What an answer value says, with option labels where there are options. */
function answerText(value, block) {
  if (value === null || value === undefined) return "cleared";
  if (typeof value === "string") {
    const option = ((block && block.options) || []).find((o) => o.id === value);
    return quoted(option ? option.label : value);
  }
  if (Array.isArray(value && value.items)) {
    const name = (list, id) =>
      ((list || []).find((o) => o.id === id) || {}).label || id || "?";
    const items = value.items.map((item, i) => {
      const parts = [
        `IV ${name(block && block.ivOptions, item.iv)}`,
        `DV ${name(block && block.dvOptions, item.dv)}`,
        `CV ${name(block && block.ivOptions, item.cv)}`,
      ];
      if (item.statement) parts.unshift(quoted(item.statement));
      return `H${i + 1} ${parts.join(", ")}`;
    });
    return short(items.join("; "));
  }
  if (value && typeof value.byHypothesis === "object") {
    const tables = Object.entries(value.byHypothesis).map(
      ([id, table]) =>
        `${id}: compare ${table.compare || "?"}, ${
          (table.trials || []).length
        } trials`
    );
    return short(tables.join("; "));
  }
  if (Array.isArray(value && value.rows)) {
    const rows = value.rows.map((row) => {
      const cells = Object.entries(row.values || {})
        .map(([trial, cell]) => `${trial} ${cell}`)
        .join(", ");
      return `${row.variable || "?"} (${cells})`;
    });
    return short(rows.join("; "));
  }
  if (typeof value === "object") {
    const blanks = (block && block.blanks) || [];
    return short(
      Object.entries(value)
        .map(([id, text]) => {
          const blank = blanks.find((b) => b.id === id);
          const option = ((blank && blank.options) || []).find(
            (o) => o.id === text
          );
          return `${id} ${quoted(option ? option.label : text)}`;
        })
        .join(", ")
    );
  }
  return short(value);
}

function variableLabel(content, key) {
  const variable = ((content && content.variables) || []).find(
    (v) => v.key === key
  );
  return variable ? variable.label || key : key;
}

function pairs(values, content) {
  return Object.entries(values || {})
    .map(([key, value]) => `${variableLabel(content, key)} ${number(value)}`)
    .join(", ");
}

/** One line for an event, after its type. */
export function summarize(event, content) {
  const data = event.data || {};
  switch (event.type) {
    case "lesson_open": {
      const status = data.status === "completed" ? "completed" : "in progress";
      return `${status} · ${data.answered || 0} answers saved`;
    }
    case "step_view":
      return `${number(data.seconds)} s on screen`;
    case "answer": {
      const block = blockOf(content, event.blockId);
      const name = (block && block.key) || event.blockId || "answer";
      return `${name} = ${answerText(data.value, block)}`;
    }
    case "sim_run": {
      const inputs = pairs(data.inputs, content);
      const outputs = pairs(data.outputs, content);
      return short(`${inputs} → ${outputs}`);
    }
    case "sim_error":
      return short(
        `${data.during ? `${data.during}: ` : ""}${data.message || "error"}`
      );
    case "dialog_open":
      return data.dialog === "graph"
        ? "Graph"
        : data.dialog === "results"
        ? "Results"
        : String(data.dialog || "");
    case "graph_change":
      return short(
        `shows ${
          (data.variables || [])
            .map((key) => variableLabel(content, key))
            .join(", ") || "nothing"
        }`
      );
    case "lesson_complete":
    case "lesson_exit":
      return "";
    default:
      return Object.keys(data).length ? short(JSON.stringify(data)) : "";
  }
}
