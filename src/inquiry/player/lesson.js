/**
 * Plain helpers for reading a lesson and the student's answers. No Vue, so
 * they can be reused by the authoring preview.
 *
 * `ctx` is { answers, blocksByKey }: answers by block id, and the lesson's
 * answerable blocks by key (from keyIndex).
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

/** Blocks the player can't show yet. They never hold up Next. */
export function isNotBuilt(block) {
  return (
    block.type === "fillInBlanks" ||
    block.type === "simulation" ||
    (block.type === "designTable" && !!block.editable) ||
    (block.type === "select" && !!block.optionsFrom)
  );
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

export function isAnswered(block, value) {
  if (block.type === "freeText") {
    return typeof value === "string" && value.trim() !== "";
  }
  return value !== undefined && value !== null && value !== "";
}

/** Whether every visible, required answer on the step is filled in. */
export function canContinue(step, ctx) {
  return step.blocks.every(
    (block) =>
      !isAnswerable(block) ||
      block.optional ||
      isNotBuilt(block) ||
      !isShown(block, ctx) ||
      isAnswered(block, ctx.answers[block.id])
  );
}
