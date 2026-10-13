/**
 * Plain helpers for reading a lesson and the student's answers. No Vue, so
 * they can be reused by the authoring preview.
 *
 * `ctx` is { answers, blocksByKey, lesson }: answers by block id, the
 * lesson's answerable blocks by key (from keyIndex), and the lesson itself.
 */

const ANSWERABLE = new Set([
  "freeText",
  "choice",
  "select",
  "fillInBlanks",
  "designTable",
  "simulation",
]);

export function isAnswerable(block) {
  if (block.type === "designTable") return !!block.editable;
  return ANSWERABLE.has(block.type);
}

// --- position -----------------------------------------------------------------

/** Every step in lesson order, with its page. */
export function allSteps(content) {
  return content.pages.flatMap((page, pageIndex) =>
    page.steps.map((step) => ({ page, pageIndex, step }))
  );
}

/** Index in allSteps of a saved position; the first step if it no longer exists. */
export function stepIndex(steps, position) {
  const index = steps.findIndex(
    (s) =>
      position && s.page.id === position.pageId && s.step.id === position.stepId
  );
  return Math.max(index, 0);
}

export function positionOf({ page, step }) {
  return { pageId: page.id, stepId: step.id };
}

/** Runs of neighbouring pages that share a phase: [{ name, firstPage, lastPage }]. */
export function phasesOf(content) {
  const phases = [];
  content.pages.forEach((page, i) => {
    const last = phases[phases.length - 1];
    if (last && last.name === page.phase) last.lastPage = i;
    else phases.push({ name: page.phase, firstPage: i, lastPage: i });
  });
  return phases;
}

/** The phase a step is in, and the step's place among that phase's steps. */
export function phaseOf(steps, phases, index) {
  const pageIndex = steps[index].pageIndex;
  const phaseIndex = phases.findIndex(
    (p) => pageIndex >= p.firstPage && pageIndex <= p.lastPage
  );
  const { firstPage, lastPage } = phases[phaseIndex];
  const first = steps.findIndex((s) => s.pageIndex >= firstPage);
  const count = steps.filter(
    (s) => s.pageIndex >= firstPage && s.pageIndex <= lastPage
  ).length;
  return { phaseIndex, step: index - first + 1, stepCount: count };
}

// --- answers ------------------------------------------------------------------

export function keyIndex(content) {
  const byKey = {};
  for (const page of content.pages) {
    for (const step of page.steps) {
      for (const block of step.blocks) {
        if (block.key) byKey[block.key] = block;
      }
    }
  }
  return byKey;
}

/** The stored value a ref points at: `key`, or `key.blankId`. */
export function refValue(ref, ctx) {
  const [key, blankId] = ref.split(".");
  const block = ctx.blocksByKey[key];
  if (!block) return undefined;
  const value = ctx.answers[block.id];
  if (!blankId) return value;
  return value && typeof value === "object" ? value[blankId] : undefined;
}

/** What a ref shows as text: the option label for a choice, else the value. */
export function refText(ref, ctx) {
  const value = refValue(ref, ctx);
  if (value === undefined || value === null || value === "") return undefined;

  const [key, blankId] = ref.split(".");
  const block = ctx.blocksByKey[key];
  const options = blankId
    ? ((block.blanks || []).find((b) => b.id === blankId) || {}).options
    : block.options;
  const option = (options || []).find((o) => o.id === value);
  return option ? option.label : String(value);
}

const REF = /\{\{\s*([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_-]+)?)\s*\}\}/g;

/**
 * Replaces {{key}} with the student's earlier answer, or ___ if unanswered.
 * `escape` makes the inserted answer safe, e.g. for markdown.
 */
export function fillRefs(text, ctx, escape = (s) => s) {
  if (!text) return "";
  return text.replace(REF, (_, ref) => {
    const value = refText(ref, ctx);
    return value === undefined ? "___" : escape(value);
  });
}

export function isShown(block, ctx) {
  const rule = block.showIf;
  if (!rule) return true;
  const value = refValue(rule.ref, ctx);
  if ("equals" in rule && value !== rule.equals) return false;
  if ("notEquals" in rule && value === rule.notEquals) return false;
  if (rule.in && !rule.in.includes(value)) return false;
  return true;
}

function filled(value) {
  if (typeof value === "string") return value.trim() !== "";
  return value !== undefined && value !== null;
}

export function isAnswered(block, value) {
  switch (block.type) {
    case "freeText":
      return typeof value === "string" && value.trim() !== "";
    case "fillInBlanks":
      return !!value && block.blanks.every((b) => filled(value[b.id]));
    case "designTable":
      return (
        !!value &&
        Array.isArray(value.rows) &&
        value.rows.length === rowCountOf(block) &&
        value.rows.every(
          (row) =>
            filled(row.variable) &&
            trialsOf(block).every((t) => row.values && filled(row.values[t]))
        )
      );
    case "simulation":
      return runsOf(value).length >= minRunsOf(block);
    default:
      return filled(value);
  }
}

// --- simulations ----------------------------------------------------------------

/** Saved runs of a simulation block: [{ inputs, outputs, series, at }]. */
export function runsOf(value) {
  return (value && Array.isArray(value.runs) && value.runs) || [];
}

export function minRunsOf(block) {
  return block.minRuns || 1;
}

// --- fill in the blanks and design tables ---------------------------------------

const BLANK = /\[\[([A-Za-z0-9_-]{1,64})\]\]/g;

/** A template as paragraphs, each a list of { text } and { blank: id } pieces. */
export function parseTemplate(template) {
  return template.split(/\n\s*\n/).map((paragraph) => {
    const pieces = [];
    let last = 0;
    for (const match of paragraph.matchAll(BLANK)) {
      if (match.index > last) {
        pieces.push({ text: paragraph.slice(last, match.index) });
      }
      pieces.push({ blank: match[1] });
      last = match.index + match[0].length;
    }
    if (last < paragraph.length) pieces.push({ text: paragraph.slice(last) });
    return pieces;
  });
}

export function trialsOf(block) {
  return block.trials || ["A", "B"];
}

export function rowCountOf(block) {
  return block.rowCount || 2;
}

/**
 * Dropdown options made from the student's earlier answers, in ref order.
 * The option's id is its text, since that is what gets saved.
 */
export function optionsFrom(refs, ctx) {
  const seen = new Set();
  const options = [];
  for (const ref of refs) {
    const text = refText(ref, ctx);
    const label = text === undefined ? "" : text.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    options.push({ id: label, label });
  }
  return options;
}

/**
 * Answers on this step picked from earlier answers that are no longer among
 * the options, e.g. after the student went back and changed their hypothesis.
 * Returns [{ blockId, value }] with the corrected value (null = cleared).
 */
export function staleAnswers(step, ctx) {
  const fixes = [];
  const ids = (refs) => new Set(optionsFrom(refs, ctx).map((o) => o.id));

  for (const block of step.blocks) {
    const value = ctx.answers[block.id];
    if (value === undefined || value === null) continue;

    if (block.type === "select" && block.optionsFrom) {
      if (!ids(block.optionsFrom).has(value)) {
        fixes.push({ blockId: block.id, value: null });
      }
    } else if (block.type === "fillInBlanks") {
      const next = { ...value };
      for (const blank of block.blanks) {
        if (blank.optionsFrom && filled(next[blank.id])) {
          if (!ids(blank.optionsFrom).has(next[blank.id]))
            delete next[blank.id];
        }
      }
      if (Object.keys(next).length !== Object.keys(value).length) {
        fixes.push({ blockId: block.id, value: next });
      }
    } else if (block.type === "designTable" && block.variableOptionsFrom) {
      const valid = ids(block.variableOptionsFrom);
      let changed = false;
      const rows = (value.rows || []).map((row) => {
        if (!filled(row.variable) || valid.has(row.variable)) return row;
        changed = true;
        return { ...row, variable: "" };
      });
      if (changed) fixes.push({ blockId: block.id, value: { rows } });
    }
  }
  return fixes;
}

/** Whether every visible, required answer on the step is filled in. */
export function canContinue(step, ctx) {
  return step.blocks.every(
    (block) =>
      !isAnswerable(block) ||
      block.optional ||
      !isShown(block, ctx) ||
      isAnswered(block, ctx.answers[block.id])
  );
}
