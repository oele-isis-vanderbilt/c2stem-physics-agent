/**
 * Plain helpers for the form editor. The changing ones edit a lesson draft
 * in place; the editor hands them a copy and turns the result into JSON.
 *
 * A selection is { kind, pageId?, stepId?, blockId? } with kind one of
 * settings, variables, simulation, page, step or block. It names ids, not
 * positions, so it still points at the same thing after a move or an undo.
 */

export const BLOCK_TYPES = [
  { type: "text", label: "Text" },
  { type: "media", label: "Media" },
  { type: "freeText", label: "Free text" },
  { type: "choice", label: "Choice" },
  { type: "select", label: "Dropdown" },
  { type: "fillInBlanks", label: "Fill in the blanks" },
  { type: "designTable", label: "Design table" },
  { type: "hypotheses", label: "Hypotheses" },
  { type: "trialTable", label: "Trial table" },
  { type: "feedback", label: "Feedback" },
  { type: "simulation", label: "Simulation" },
];

export function typeLabel(type) {
  const known = BLOCK_TYPES.find((t) => t.type === type);
  return known ? known.label : type || "Block";
}

// Blocks whose answer is text that can be quoted, compared or offered as an option
const VALUE_BLOCKS = new Set(["freeText", "choice", "select", "fillInBlanks"]);
// Text fields that may hold {{refs}}, as in the service's validator
const TEMPLATED = ["md", "prompt", "placeholder", "template"];
// Fields that hold one answer name on its own, not inside text
const BARE_REFS = new Set(["ref", "hypothesesFrom"]);
const MAX_ID = 64;

const copy = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => !!value && typeof value === "object";

// --- reading --------------------------------------------------------------------

/** Why the form can't show a draft, or null when it can. */
export function unformable(draft) {
  if (!isObject(draft) || Array.isArray(draft)) {
    return "The lesson JSON isn't an object.";
  }
  if (!Array.isArray(draft.pages)) return "The lesson has no pages list.";
  for (const page of draft.pages) {
    if (!isObject(page) || !Array.isArray(page.steps)) {
      return "Every page needs a steps list.";
    }
    for (const step of page.steps) {
      if (!isObject(step) || !Array.isArray(step.blocks)) {
        return "Every step needs a blocks list.";
      }
      if (step.blocks.some((b) => !isObject(b))) {
        return "Every block needs to be an object.";
      }
    }
  }
  return null;
}

/** Every block in reading order: [{ page, p, step, s, block, b }]. */
export function blocksOf(draft) {
  const found = [];
  draft.pages.forEach((page, p) =>
    page.steps.forEach((step, s) =>
      step.blocks.forEach((block, b) =>
        found.push({ page, p, step, s, block, b })
      )
    )
  );
  return found;
}

/** Positions { p, s, b } of a selection in the draft, or null if it's gone. */
export function locate(draft, sel) {
  if (!sel || !["page", "step", "block"].includes(sel.kind)) return null;
  const p = draft.pages.findIndex((page) => page.id === sel.pageId);
  if (p < 0) return null;
  if (sel.kind === "page") return { p };
  const s = draft.pages[p].steps.findIndex((step) => step.id === sel.stepId);
  if (s < 0) return null;
  if (sel.kind === "step") return { p, s };
  const b = draft.pages[p].steps[s].blocks.findIndex(
    (block) => block.id === sel.blockId
  );
  return b < 0 ? null : { p, s, b };
}

/** The page, step or block a selection names, or null. */
export function itemAt(draft, sel) {
  const at = locate(draft, sel);
  if (!at) return null;
  const page = draft.pages[at.p];
  if (at.s === undefined) return page;
  const step = page.steps[at.s];
  return at.b === undefined ? step : step.blocks[at.b];
}

/** The JSON path of a selection, e.g. pages/1/steps/0/blocks/2. */
export function pathOf(draft, sel) {
  if (sel.kind === "variables" || sel.kind === "simulation") return sel.kind;
  const at = locate(draft, sel);
  if (!at) return "";
  let path = `pages/${at.p}`;
  if (at.s !== undefined) path += `/steps/${at.s}`;
  if (at.b !== undefined) path += `/blocks/${at.b}`;
  return path;
}

/**
 * The selection an issue path belongs to, plus `rel`: the rest of the path
 * inside a block, e.g. options/1/label.
 */
export function selectionOfPath(draft, path) {
  const parts = (path || "").split("/").filter(Boolean);
  if (parts[0] === "variables" || parts[0] === "simulation") {
    return { kind: parts[0] };
  }
  const settings = { kind: "settings" };
  if (parts[0] !== "pages" || parts.length < 2) return settings;
  const page = draft.pages[Number(parts[1])];
  if (!page) return settings;
  const pageSel = { kind: "page", pageId: page.id };
  if (parts[2] !== "steps" || parts.length < 4) return pageSel;
  const step = page.steps[Number(parts[3])];
  if (!step) return pageSel;
  const stepSel = { kind: "step", pageId: page.id, stepId: step.id };
  if (parts[4] !== "blocks" || parts.length < 6) return stepSel;
  const block = step.blocks[Number(parts[5])];
  if (!block) return stepSel;
  return {
    kind: "block",
    pageId: page.id,
    stepId: step.id,
    blockId: block.id,
    rel: parts.slice(6).join("/"),
  };
}

/** A string naming a selection, for comparing and as a map key. */
export function selectionKey(sel) {
  if (!sel) return "";
  return [sel.kind, sel.pageId, sel.stepId, sel.blockId]
    .filter((part) => part !== undefined)
    .join("|");
}

/** Every page, step and block id. */
export function idsOf(draft) {
  const ids = new Set();
  draft.pages.forEach((page) => {
    ids.add(page.id);
    page.steps.forEach((step) => {
      ids.add(step.id);
      step.blocks.forEach((block) => ids.add(block.id));
    });
  });
  return ids;
}

/** Ids of a page, step or block and everything inside it. */
export function idsInside(item) {
  const ids = [item.id];
  for (const step of item.steps || []) ids.push(...idsInside(step));
  for (const block of item.blocks || []) ids.push(block.id);
  return ids;
}

export function keysOf(draft) {
  return new Set(
    blocksOf(draft)
      .map(({ block }) => block.key)
      .filter(Boolean)
  );
}

/** A short line of what a block says, for the outline. */
export function blockSummary(block) {
  let text =
    block.prompt ||
    block.md ||
    block.template ||
    block.title ||
    (block.items &&
      block.items[0] &&
      (block.items[0].caption || block.items[0].alt)) ||
    "";
  text = String(text)
    .replace(/\[\[[^\]]*\]\]/g, "…")
    .replace(/[#*_`>[\]()!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

// --- earlier answers ------------------------------------------------------------------

function promptOf(block) {
  const text = blockSummary(block);
  return text ? `${block.key}: ${text}` : block.key;
}

/**
 * Answers before a block that it may show, test or offer as options:
 * [{ ref, label, options }]. `options` are the fixed choices, if any.
 * Fill-in-the-blanks blocks are offered blank by blank.
 */
export function earlierAnswers(draft, blockId) {
  const answers = [];
  for (const { block } of blocksOf(draft)) {
    if (block.id === blockId) break;
    if (!block.key || !VALUE_BLOCKS.has(block.type)) continue;
    if (block.type === "fillInBlanks") {
      for (const blank of block.blanks || []) {
        answers.push({
          ref: `${block.key}.${blank.id}`,
          label: `${block.key}.${blank.id}`,
          options: blank.options || null,
        });
      }
    } else {
      answers.push({
        ref: block.key,
        label: promptOf(block),
        options: block.options || null,
      });
    }
  }
  return answers;
}

const refPattern = (key) =>
  new RegExp(`\\{\\{\\s*${key}(\\.[A-Za-z0-9_-]+)?\\s*\\}\\}`, "g");
const refNames = (ref, key) => ref === key || ref.startsWith(`${key}.`);

/** Calls visit(holder, field) for every text field or ref list in a block. */
function eachRefField(block, visit) {
  for (const field of TEMPLATED)
    if (typeof block[field] === "string") visit(block, field);
  for (const option of Array.isArray(block.options) ? block.options : []) {
    if (!isObject(option)) continue;
    for (const field of ["label", "prompt"]) {
      if (typeof option[field] === "string") visit(option, field);
    }
  }
  for (const blank of Array.isArray(block.blanks) ? block.blanks : []) {
    if (!isObject(blank)) continue;
    if (typeof blank.placeholder === "string") visit(blank, "placeholder");
    if (Array.isArray(blank.optionsFrom)) visit(blank, "optionsFrom");
  }
  for (const field of ["optionsFrom", "variableOptionsFrom"]) {
    if (Array.isArray(block[field])) visit(block, field);
  }
  if (isObject(block.showIf) && typeof block.showIf.ref === "string") {
    visit(block.showIf, "ref");
  }
  if (typeof block.hypothesesFrom === "string") visit(block, "hypothesesFrom");
}

/** How many places use an answer name: {{key}}, dropdown lists, show-if rules. */
export function keyUses(draft, key) {
  if (!key) return 0;
  let uses = 0;
  for (const { block } of blocksOf(draft)) {
    eachRefField(block, (holder, field) => {
      const value = holder[field];
      if (Array.isArray(value)) {
        uses += value.filter(
          (ref) => typeof ref === "string" && refNames(ref, key)
        ).length;
      } else if (BARE_REFS.has(field)) {
        if (refNames(value, key)) uses += 1;
      } else {
        uses += (value.match(refPattern(key)) || []).length;
      }
    });
  }
  return uses;
}

/** Renames an answer and every place that uses it. */
export function renameKey(draft, from, to) {
  const rename = (ref) =>
    typeof ref === "string" && refNames(ref, from)
      ? to + ref.slice(from.length)
      : ref;
  for (const { block } of blocksOf(draft)) {
    if (block.key === from) block.key = to;
    eachRefField(block, (holder, field) => {
      const value = holder[field];
      if (Array.isArray(value)) holder[field] = value.map(rename);
      else if (BARE_REFS.has(field)) holder[field] = rename(value);
      else {
        holder[field] = value.replace(
          refPattern(from),
          (_, blank) => `{{${to}${blank || ""}}}`
        );
      }
    });
  }
}

/** How many places use one exact ref, e.g. hypothesis.iv for one blank. */
export function refUses(draft, ref) {
  const [key, blank] = ref.split(".");
  const exact = new RegExp(
    `\\{\\{\\s*${key}${blank ? `\\.${blank}` : ""}\\s*\\}\\}`,
    "g"
  );
  let uses = 0;
  for (const { block } of blocksOf(draft)) {
    eachRefField(block, (holder, field) => {
      const value = holder[field];
      if (Array.isArray(value)) uses += value.filter((r) => r === ref).length;
      else if (BARE_REFS.has(field)) uses += value === ref ? 1 : 0;
      else uses += (value.match(exact) || []).length;
    });
  }
  return uses;
}

// --- fill in the blanks ------------------------------------------------------------

const BLANK = /\[\[([A-Za-z0-9_-]{1,64})\]\]/g;

/** Gap ids in a template, in order, each once. */
export function templateBlanks(template) {
  const ids = [];
  for (const match of String(template || "").matchAll(BLANK)) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

/**
 * Makes a block's blanks follow its template: one per gap, in gap order.
 * A gap without settings gets those in `kept` (by id), else a typed blank.
 * Returns the blanks that were dropped, so they can be kept.
 */
export function syncBlanks(block, kept = {}) {
  const old = Array.isArray(block.blanks) ? block.blanks : [];
  const byId = Object.fromEntries(
    old.filter(isObject).map((blank) => [blank.id, blank])
  );
  const ids = templateBlanks(block.template);
  block.blanks = ids.map((id) => byId[id] || kept[id] || { id, input: "text" });
  return old.filter((blank) => isObject(blank) && !ids.includes(blank.id));
}

/** A gap id not used in the template or the blanks yet: b1, b2, … */
export function newBlankId(block) {
  const used = new Set([
    ...templateBlanks(block.template),
    ...(Array.isArray(block.blanks) ? block.blanks.map((b) => b && b.id) : []),
  ]);
  for (let n = 1; ; n++) if (!used.has(`b${n}`)) return `b${n}`;
}

// --- variables ------------------------------------------------------------------------

const variablesOf = (draft) =>
  Array.isArray(draft.variables) ? draft.variables : [];
const simulationBlocks = (draft) =>
  blocksOf(draft).filter(({ block }) => block.type === "simulation");

/** Where a lesson variable is used, as short descriptions. */
export function variableUses(draft, key) {
  const uses = [];
  const sim = draft.simulation;
  if (sim) {
    if (isObject(sim.inputs) && key in sim.inputs)
      uses.push("the simulation's inputs");
    if (isObject(sim.outputs) && key in sim.outputs) {
      uses.push("the simulation's outputs");
    }
    if (sim.timeSeries && (sim.timeSeries.columns || []).includes(key)) {
      uses.push("the recorded-over-time columns");
    }
  }
  for (const { block, p, s } of simulationBlocks(draft)) {
    const lists = [block.inputs, block.outputs, block.graph && block.graph.y];
    if (lists.some((list) => Array.isArray(list) && list.includes(key))) {
      uses.push(`the Simulation block on page ${p + 1}, step ${s + 1}`);
    }
  }
  return uses;
}

/** A mapping object with one property renamed, in the same place. */
function renameProperty(object, from, to) {
  if (!isObject(object) || !(from in object)) return object;
  return Object.fromEntries(
    Object.entries(object).map(([k, v]) => [k === from ? to : k, v])
  );
}

const swap = (list, from, to) =>
  Array.isArray(list) ? list.map((item) => (item === from ? to : item)) : list;

/** Renames a lesson variable and every place that uses it. */
export function renameVariable(draft, from, to) {
  for (const variable of variablesOf(draft)) {
    if (variable.key === from) variable.key = to;
  }
  const sim = draft.simulation;
  if (sim) {
    sim.inputs = renameProperty(sim.inputs, from, to);
    sim.outputs = renameProperty(sim.outputs, from, to);
    if (sim.timeSeries) {
      sim.timeSeries.columns = swap(sim.timeSeries.columns, from, to);
    }
  }
  for (const { block } of simulationBlocks(draft)) {
    block.inputs = swap(block.inputs, from, to);
    block.outputs = swap(block.outputs, from, to);
    if (block.graph) block.graph.y = swap(block.graph.y, from, to);
  }
}

/** Takes a variable out of simulation blocks' sliders, readouts and graphs. */
function dropFromBlocks(draft, key) {
  for (const { block } of simulationBlocks(draft)) {
    for (const field of ["inputs", "outputs"]) {
      if (Array.isArray(block[field])) {
        block[field] = block[field].filter((k) => k !== key);
      }
    }
    if (block.graph && Array.isArray(block.graph.y)) {
      block.graph.y = block.graph.y.filter((k) => k !== key);
      if (!block.graph.y.length) delete block.graph;
    }
  }
}

/**
 * Deletes a variable, its mapping and its place in simulation blocks.
 * A recorded-over-time column keeps its place, since columns are matched
 * to the project's list by position; the validator points it out.
 */
export function removeVariable(draft, key) {
  draft.variables = variablesOf(draft).filter((v) => v.key !== key);
  const sim = draft.simulation;
  if (sim) {
    if (isObject(sim.inputs)) delete sim.inputs[key];
    if (isObject(sim.outputs)) delete sim.outputs[key];
  }
  dropFromBlocks(draft, key);
}

/**
 * Makes a variable an input or an output. Its mapping moves across, and
 * simulation blocks stop listing it where it no longer fits.
 */
export function setVariableRole(draft, key, role) {
  const variable = variablesOf(draft).find((v) => v.key === key);
  if (!variable || variable.role === role) return;
  variable.role = role;
  const sim = draft.simulation;
  const [from, to] =
    role === "input" ? ["outputs", "inputs"] : ["inputs", "outputs"];
  if (sim && isObject(sim[from]) && key in sim[from]) {
    sim[to] = { ...sim[to], [key]: sim[from][key] };
    delete sim[from][key];
  }
  dropFromBlocks(draft, key);
}

/** A variable name not used yet, made from text like "cart mass" (cartMass). */
export function newVariableKey(draft, text) {
  const words = String(text || "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let stem = words
    .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase()))
    .join("")
    .slice(0, 60);
  if (!/^[A-Za-z]/.test(stem)) stem = `v${stem}`;
  const used = new Set(variablesOf(draft).map((v) => v.key));
  if (!used.has(stem)) return stem;
  for (let n = 2; ; n++) if (!used.has(`${stem}${n}`)) return `${stem}${n}`;
}

/** Settings for a new lesson simulation, to fill in with the form. */
export function newSimulation(draft) {
  const base = slug(draft.title || "simulation").replace(/-./g, (m) =>
    m[1].toUpperCase()
  );
  return {
    key: /^[A-Za-z]/.test(base) ? base.slice(0, 64) : "simulation",
    adapter: "netsblox",
    source: "https://physics.c2stem.org",
    owner: "",
    project: "",
    inputs: {},
    outputs: {},
    run: { mode: "greenFlag" },
    done: { mode: "poll", variable: "time", timeoutMs: 120000 },
  };
}

// --- new things -------------------------------------------------------------------

function slug(text) {
  const s = String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "item";
}

/**
 * A new id readable enough to recognise in exports, with a random end so
 * it never repeats one used before, even in an older version.
 */
export function newId(draft, base, taken = new Set()) {
  const used = idsOf(draft);
  const stem = slug(base).slice(0, MAX_ID - 5);
  for (;;) {
    const id = `${stem}-${Math.random().toString(36).slice(2, 6)}`;
    if (!used.has(id) && !taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
}

/** The first unused answer name like base1, base2. */
export function newKey(draft, base, taken = new Set()) {
  const keys = keysOf(draft);
  const stem = String(base).replace(/\d+$/, "") || "answer";
  for (let n = 1; ; n++) {
    const key = `${stem}${n}`;
    if (!keys.has(key) && !taken.has(key)) {
      taken.add(key);
      return key;
    }
  }
}

const KEY_BASE = {
  freeText: "answer",
  choice: "choice",
  select: "pick",
  fillInBlanks: "blanks",
  designTable: "design",
  hypotheses: "hypotheses",
  trialTable: "trials",
  simulation: "runs",
};

/** Placeholder options for a new Hypotheses block, for the author to rename. */
const placeholders = (letters) =>
  letters.map((l) => ({ id: `variable${l}`, label: `Variable ${l}` }));

/**
 * Options made from the lesson's variables: inputs (sliders) for the
 * independent and controlled variables, outputs (measured) for the dependent.
 * Option ids are the variable keys, so trial-table columns show their units.
 */
export function variableOptions(draft) {
  const of = (role) =>
    variablesOf(draft)
      .filter((v) => v.role === role && v.key)
      .map((v) => ({ id: v.key, label: v.label || v.key }));
  return { ivOptions: of("input"), dvOptions: of("output") };
}

/** Answer names of the lesson's Hypotheses blocks, in reading order. */
export function hypothesesKeys(draft, beforeBlockId) {
  const keys = [];
  for (const { block } of blocksOf(draft)) {
    if (block.id === beforeBlockId) break;
    if (block.type === "hypotheses" && block.key) keys.push(block.key);
  }
  return keys;
}

/** A block of a type with starting content an author edits from. */
export function newBlock(draft, type, idBase) {
  const block = { id: newId(draft, `${idBase}-${type}`), type };
  if (KEY_BASE[type]) block.key = newKey(draft, KEY_BASE[type]);
  const two = () => [
    { id: "o1", label: "Option 1" },
    { id: "o2", label: "Option 2" },
  ];
  const variables = Array.isArray(draft.variables) ? draft.variables : [];
  const roleKeys = (role) =>
    variables.filter((v) => v.role === role).map((v) => v.key);

  switch (type) {
    case "text":
      return { ...block, md: "New text." };
    case "feedback":
      return { ...block, md: "Well done!", tone: "info" };
    case "media":
      return { ...block, items: [{ kind: "image", url: "", alt: "" }] };
    case "freeText":
      return { ...block, prompt: "Type your question here." };
    case "choice":
      return { ...block, prompt: "Pick one.", options: two() };
    case "select":
      return { ...block, prompt: "Choose one.", options: two() };
    case "fillInBlanks":
      return {
        ...block,
        template: "The cart moved [[b1]].",
        blanks: [{ id: "b1", input: "text" }],
      };
    case "designTable":
      return { ...block, title: "My experiment", editable: true, rowCount: 2 };
    case "hypotheses":
      return {
        ...block,
        statement: true,
        minHypotheses: 1,
        maxHypotheses: 1,
        ivOptions: placeholders(["A", "B", "C"]),
        dvOptions: placeholders(["D", "E"]),
      };
    case "trialTable": {
      // Belongs to the lesson's last Hypotheses block, if there is one yet
      const keys = hypothesesKeys(draft);
      const table = {
        ...block,
        comparePrompt: "We compare the resulting values of:",
        minTrials: 2,
        maxTrials: 5,
      };
      if (keys.length) table.hypothesesFrom = keys[keys.length - 1];
      return table;
    }
    case "simulation": {
      const sim = {
        ...block,
        inputs: roleKeys("input"),
        outputs: roleKeys("output"),
      };
      const series = draft.simulation && draft.simulation.timeSeries;
      const y = series
        ? series.columns.filter((c) => c !== "time" && sim.outputs.includes(c))
        : [];
      if (y.length) sim.graph = { x: "time", y };
      return sim;
    }
    default:
      return block;
  }
}

function newStep(draft, page) {
  return { id: newId(draft, `${page.id}-step`), blocks: [] };
}

/** Adds a page after page index `after` (-1 = first). Returns its selection. */
export function addPage(draft, after = draft.pages.length - 1) {
  const before = draft.pages[after];
  const page = {
    id: newId(draft, "page"),
    phase: (before && before.phase) || "Orientation",
    steps: [],
  };
  page.steps.push(newStep(draft, page));
  draft.pages.splice(after + 1, 0, page);
  return { kind: "page", pageId: page.id };
}

export function addStep(draft, p, after = draft.pages[p].steps.length - 1) {
  const page = draft.pages[p];
  const step = newStep(draft, page);
  page.steps.splice(after + 1, 0, step);
  return { kind: "step", pageId: page.id, stepId: step.id };
}

export function addBlock(draft, p, s, type, after) {
  const page = draft.pages[p];
  const step = page.steps[s];
  const block = newBlock(draft, type, page.id);
  const at = after === undefined ? step.blocks.length : after + 1;
  step.blocks.splice(at, 0, block);
  return { kind: "block", pageId: page.id, stepId: step.id, blockId: block.id };
}

// --- moving, copying, deleting ----------------------------------------------------------

/**
 * Where a page, step or block lands when moved one place up (-1) or down (1).
 * Steps and blocks cross into the neighbouring page or step at the ends.
 * Returns { list, index } to insert into, or null when it can't move.
 */
function moveTarget(draft, sel, dir) {
  const at = locate(draft, sel);
  if (!at) return null;
  const { pages } = draft;

  if (sel.kind === "page") {
    const index = at.p + dir;
    return index >= 0 && index < pages.length ? { list: pages, index } : null;
  }

  if (sel.kind === "step") {
    const steps = pages[at.p].steps;
    const index = at.s + dir;
    if (index >= 0 && index < steps.length) return { list: steps, index };
    // A page keeps at least one step
    const next = pages[at.p + dir];
    if (!next || steps.length < 2) return null;
    return {
      list: next.steps,
      index: dir < 0 ? next.steps.length : 0,
      across: true,
    };
  }

  const blocks = pages[at.p].steps[at.s].blocks;
  const index = at.b + dir;
  if (index >= 0 && index < blocks.length) return { list: blocks, index };
  const flat = pages.flatMap((page) => page.steps);
  const here = flat.indexOf(pages[at.p].steps[at.s]);
  const next = flat[here + dir];
  if (!next) return null;
  return {
    list: next.blocks,
    index: dir < 0 ? next.blocks.length : 0,
    across: true,
  };
}

export function canMove(draft, sel, dir) {
  return !!moveTarget(draft, sel, dir);
}

/** Moves a page, step or block. Returns its new selection, or null. */
export function move(draft, sel, dir) {
  const target = moveTarget(draft, sel, dir);
  if (!target) return null;
  const at = locate(draft, sel);
  const from =
    sel.kind === "page"
      ? draft.pages
      : sel.kind === "step"
      ? draft.pages[at.p].steps
      : draft.pages[at.p].steps[at.s].blocks;
  const index = sel.kind === "page" ? at.p : sel.kind === "step" ? at.s : at.b;
  const [item] = from.splice(index, 1);
  target.list.splice(target.index, 0, item);

  // Read the new parents back from the draft
  if (sel.kind === "page") return sel;
  for (const page of draft.pages) {
    for (const step of page.steps) {
      if (sel.kind === "step" && step === item) {
        return { ...sel, pageId: page.id };
      }
      if (sel.kind === "block" && step.blocks.includes(item)) {
        return { ...sel, pageId: page.id, stepId: step.id };
      }
    }
  }
  return sel;
}

/** Gives a copied page, step or block new ids, and copied answers new names. */
function freshen(draft, item, idBase, taken) {
  const base =
    idBase || String(item.id || "item").replace(/-[a-z0-9]{1,4}$/, "");
  item.id = newId(draft, base, taken.ids);
  if (item.key) item.key = newKey(draft, item.key, taken.keys);
  for (const step of item.steps || []) {
    freshen(draft, step, `${item.id}-step`, taken);
  }
  for (const block of item.blocks || []) freshen(draft, block, null, taken);
}

/** Copies a page, step or block in after itself. Returns the copy's selection. */
export function duplicate(draft, sel) {
  const at = locate(draft, sel);
  if (!at) return null;
  const item = copy(itemAt(draft, sel));
  freshen(draft, item, null, { ids: new Set(), keys: new Set() });

  if (sel.kind === "page") {
    draft.pages.splice(at.p + 1, 0, item);
    return { kind: "page", pageId: item.id };
  }
  const page = draft.pages[at.p];
  if (sel.kind === "step") {
    page.steps.splice(at.s + 1, 0, item);
    return { kind: "step", pageId: page.id, stepId: item.id };
  }
  const step = page.steps[at.s];
  step.blocks.splice(at.b + 1, 0, item);
  return { kind: "block", pageId: page.id, stepId: step.id, blockId: item.id };
}

/** A lesson keeps at least one page, and a page at least one step. */
export function canRemove(draft, sel) {
  const at = locate(draft, sel);
  if (!at) return false;
  if (sel.kind === "page") return draft.pages.length > 1;
  if (sel.kind === "step") return draft.pages[at.p].steps.length > 1;
  return sel.kind === "block";
}

/** Deletes a page, step or block. Returns what to select next. */
export function remove(draft, sel) {
  const at = locate(draft, sel);
  const page = draft.pages[at.p];
  if (sel.kind === "page") {
    draft.pages.splice(at.p, 1);
    const near = draft.pages[Math.min(at.p, draft.pages.length - 1)];
    return { kind: "page", pageId: near.id };
  }
  if (sel.kind === "step") {
    page.steps.splice(at.s, 1);
    const near = page.steps[Math.min(at.s, page.steps.length - 1)];
    return { kind: "step", pageId: page.id, stepId: near.id };
  }
  const step = page.steps[at.s];
  step.blocks.splice(at.b, 1);
  const near = step.blocks[Math.min(at.b, step.blocks.length - 1)];
  return near
    ? { kind: "block", pageId: page.id, stepId: step.id, blockId: near.id }
    : { kind: "step", pageId: page.id, stepId: step.id };
}
