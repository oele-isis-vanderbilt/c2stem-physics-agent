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
  "hypotheses",
  "trialTable",
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

/** Whether a block's answer is complete. `ctx` is needed by trial tables. */
export function isAnswered(block, value, ctx) {
  switch (block.type) {
    case "freeText":
      if (block.hypothesesFrom) return perHypothesisAnswered(block, value, ctx);
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
    case "hypotheses":
      return hypothesesAnswered(block, value);
    case "trialTable":
      return trialTableAnswered(block, value, ctx);
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

// --- hypotheses and trial tables ---------------------------------------------------

/** A hypothesis: { id, statement, iv, dv, cv }, the variables as option ids. */
function emptyHypothesis(id) {
  return { id, statement: "", iv: "", dv: "", cv: "" };
}

export function minHypothesesOf(block) {
  return block.minHypotheses || 1;
}

export function maxHypothesesOf(block) {
  return Math.max(block.maxHypotheses || 1, minHypothesesOf(block));
}

/** Whether the "My hypothesis is" box is shown; on unless turned off. */
export function asksStatement(block) {
  return block.statement !== false;
}

/**
 * The student's hypotheses, with empty ones added up to the minimum so a
 * lesson that asks for two shows two from the start.
 */
export function hypothesesOf(block, value) {
  const saved = (value && Array.isArray(value.items) && value.items) || [];
  const items = saved.map((item) => ({ ...emptyHypothesis(item.id), ...item }));
  while (items.length < minHypothesesOf(block)) {
    items.push(emptyHypothesis(newHypothesisId(items)));
  }
  return items;
}

/** h1, h2, … : the first id no hypothesis uses, so a removed one isn't reused by mistake. */
export function newHypothesisId(items) {
  const used = new Set(items.map((item) => item.id));
  let n = items.length + 1;
  while (used.has(`h${n}`)) n += 1;
  return `h${n}`;
}

/** Controlled-variable options: the independent ones, less the one chosen as independent. */
export function controlledOptions(block, hypothesis) {
  return block.ivOptions.filter((o) => o.id !== hypothesis.iv);
}

/** Whether one hypothesis has every part the lesson asks for. */
export function hypothesisDone(block, item) {
  const has = (options, id) => options.some((o) => o.id === id);
  return (
    (!asksStatement(block) || filled(item.statement)) &&
    has(block.ivOptions, item.iv) &&
    has(block.dvOptions, item.dv) &&
    has(controlledOptions(block, item), item.cv)
  );
}

function hypothesesAnswered(block, value) {
  const items = hypothesesOf(block, value);
  return (
    items.length <= maxHypothesesOf(block) &&
    items.every((item) => hypothesisDone(block, item))
  );
}

/**
 * The Hypotheses block a trial table or per-hypothesis question belongs to
 * (block.hypothesesFrom), and the student's hypotheses: { block, items }.
 */
export function hypothesisSource(block, ctx) {
  const source = ctx.blocksByKey[block.hypothesesFrom];
  if (!source || source.type !== "hypotheses") return null;
  return { block: source, items: hypothesesOf(source, ctx.answers[source.id]) };
}

export function minTrialsOf(block) {
  return block.minTrials || 2;
}

export function maxTrialsOf(block) {
  return Math.max(block.maxTrials || 5, minTrialsOf(block));
}

/** One hypothesis's part of a trial table: { compare, trials }, padded to the minimum rows. */
export function tableFor(block, value, hypothesisId) {
  const saved =
    (value && value.byHypothesis && value.byHypothesis[hypothesisId]) || {};
  const trials = (Array.isArray(saved.trials) ? saved.trials : []).map(
    (row) => ({ ...row })
  );
  while (trials.length < minTrialsOf(block)) trials.push({});
  return { compare: saved.compare || "", trials };
}

/** A filled trial cell: a number, saved as typed ("1.5"). */
function isNumber(value) {
  if (typeof value === "number") return Number.isFinite(value);
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  );
}

export function tableDone(block, value, source, hypothesisId) {
  const table = tableFor(block, value, hypothesisId);
  return (
    source.block.dvOptions.some((o) => o.id === table.compare) &&
    table.trials.length <= maxTrialsOf(block) &&
    table.trials.every((row) =>
      source.block.ivOptions.every((o) => isNumber(row[o.id]))
    )
  );
}

/** A free-text block answered once for each hypothesis of an earlier Hypotheses block. */
export function answersPerHypothesis(block) {
  return block.type === "freeText" && !!block.hypothesesFrom;
}

/** One hypothesis's text in a per-hypothesis answer: { byHypothesis: { h1: "…" } }. */
export function textFor(value, hypothesisId) {
  const text = value && value.byHypothesis && value.byHypothesis[hypothesisId];
  return typeof text === "string" ? text : "";
}

function perHypothesisAnswered(block, value, ctx) {
  const source = ctx && hypothesisSource(block, ctx);
  return (
    !!source && source.items.every((item) => filled(textFor(value, item.id)))
  );
}

/**
 * The hypotheses a step's per-hypothesis questions answer, so the player can
 * show one selector above them: [{ key, items, blocks }], one per Hypotheses
 * block the step's visible questions point at.
 */
export function stepHypotheses(step, ctx) {
  const groups = [];
  for (const block of step.blocks) {
    if (!answersPerHypothesis(block) || !isShown(block, ctx)) continue;
    let group = groups.find((g) => g.key === block.hypothesesFrom);
    if (!group) {
      const source = hypothesisSource(block, ctx);
      if (!source) continue;
      groups.push(
        (group = { key: block.hypothesesFrom, ...source, blocks: [] })
      );
    }
    group.blocks.push(block);
  }
  return groups;
}

function trialTableAnswered(block, value, ctx) {
  const source = ctx && hypothesisSource(block, ctx);
  return (
    !!source &&
    source.items.every((item) => tableDone(block, value, source, item.id))
  );
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
    } else if (block.type === "trialTable" || answersPerHypothesis(block)) {
      // Drop the answers of hypotheses the student has since removed
      const source = hypothesisSource(block, ctx);
      const byHypothesis = value.byHypothesis || {};
      if (!source) continue;
      const kept = new Set(source.items.map((item) => item.id));
      const stale = Object.keys(byHypothesis).filter((id) => !kept.has(id));
      if (stale.length) {
        const next = { ...byHypothesis };
        stale.forEach((id) => delete next[id]);
        fixes.push({ blockId: block.id, value: { byHypothesis: next } });
      }
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
      isAnswered(block, ctx.answers[block.id], ctx)
  );
}
