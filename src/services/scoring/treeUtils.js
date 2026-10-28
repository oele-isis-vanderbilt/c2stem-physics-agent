/**
 * treeUtils - helpers for reading the block tree built by ASTController.
 *
 * Block node: { id, name, ownerId, next: { contained: [inputs], next: nextBlock } }
 *   name is the selector (e.g. "setXNetForce") or "var: <name>" for a variable.
 * Literal input: a node without an id, e.g. { name: "5" }.
 */

// Inputs that hold a body (C-slot) for each C-shaped block
const BODY_SLOTS = {
  doIf: [1],
  doIfElse: [1, 2],
  doForever: [0],
  doRepeat: [1],
  doUntil: [1],
};

// Comparison blocks: [operator, whether the operands are swapped to read as "<"]
const COMPARISONS = {
  reportLessThan: ["<", false],
  reportGreaterThan: ["<", true],
  reportLessThanOrEquals: ["<=", false],
  reportGreaterThanOrEquals: ["<=", true],
};

function inputs(node) {
  return (node && node.next && node.next.contained) || [];
}

function input(node, index) {
  return inputs(node)[index];
}

function isBlock(node) {
  return !!(node && node.id);
}

function nextBlock(node) {
  const next = node && node.next && node.next.next;
  return isBlock(next) ? next : null;
}

// Blocks linked one after another, starting at `first`
function chain(first) {
  const blocks = [];
  const seen = new Set();
  for (let node = first; isBlock(node) && !seen.has(node.id); ) {
    seen.add(node.id);
    blocks.push(node);
    node = nextBlock(node);
  }
  return blocks;
}

// Top-level blocks of a script, without its hat block
function scriptBody(root) {
  return chain(nextBlock(root));
}

// Input indexes that hold a body; [] for blocks that are not C-shaped
function bodySlots(block) {
  return BODY_SLOTS[block.name] || [];
}

// Bodies of a C-shaped block, each as a list of top-level blocks
function bodies(block) {
  return (BODY_SLOTS[block.name] || []).map((slot) =>
    chain(input(block, slot))
  );
}

// Every command block in `blocks`, including nested bodies, with the
// C-shaped blocks that enclose it (outermost first)
function walk(blocks, enclosing = [], out = []) {
  for (const block of blocks) {
    out.push({ block, enclosing });
    for (const body of bodies(block)) {
      walk(body, [...enclosing, block], out);
    }
  }
  return out;
}

// Scripts (tree roots in the store) that belong to the named sprites, or all
// of them when `spriteNames` is null. If none of the names is in the store's
// sprite map (e.g. the project XML could not be loaded), every script is kept.
function rootsOfSprites(store, spriteNames) {
  const roots = store.getters.getTreeRoots || [];
  if (!spriteNames) return roots;

  const sprites = store.getters.getSprites || {};
  const ids = Object.keys(sprites).filter((id) =>
    spriteNames.includes(sprites[id])
  );
  if (ids.length === 0) {
    console.warn(
      `[Sprites] Sprite(s) ${spriteNames.join(
        ", "
      )} not found; using every script`
    );
    return roots;
  }
  return roots.filter((root) => ids.includes(root.ownerId));
}

// Variable names compare without spaces, "?" or case: "is pushing?" = "ispushing"
function normalizeName(name) {
  return String(name).toLowerCase().replace(/[\s?]/g, "");
}

function literalText(node) {
  if (!node || isBlock(node) || node.name === undefined || node.name === null) {
    return null;
  }
  return String(node.name).trim();
}

function numberValue(node) {
  const text = literalText(node);
  if (text === null || text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

// Variable reporter ("var: push force") -> "pushforce"
function variableName(node) {
  if (!isBlock(node) || !node.name.startsWith("var: ")) return null;
  return normalizeName(node.name.slice("var: ".length));
}

// true/false from a boolean block or typed text, otherwise null
function boolValue(node) {
  const source =
    isBlock(node) &&
    (node.name === "reportBoolean" || node.name === "reportFalse")
      ? input(node, 0)
      : node;
  const text = literalText(source);
  if (text === null) return null;
  if (text.toLowerCase() === "true") return true;
  if (text.toLowerCase() === "false") return false;
  return null;
}

// Comparison as { op: "<" | "<=", left, right }; "a > b" reads as "b < a"
function comparison(node) {
  const entry = isBlock(node) && COMPARISONS[node.name];
  if (!entry) return null;
  const [op, swapped] = entry;
  const a = input(node, 0);
  const b = input(node, 1);
  return swapped ? { op, left: b, right: a } : { op, left: a, right: b };
}

// Value of an arithmetic expression, or NaN when it holds anything else.
// env: { variables: { normalizedName: number }, reporters: { selector: number } }
const OPERATORS = {
  reportSum: (a, b) => a + b,
  reportDifference: (a, b) => a - b,
  reportProduct: (a, b) => a * b,
  reportQuotient: (a, b) => a / b,
  reportPower: (a, b) => Math.pow(a, b),
};
const MONADIC = { neg: (a) => -a, abs: Math.abs, sqrt: Math.sqrt };

function evaluate(node, env = {}) {
  if (!isBlock(node)) {
    const value = numberValue(node);
    return value === null ? NaN : value;
  }
  const variable = variableName(node);
  if (variable !== null) {
    const value = (env.variables || {})[variable];
    return value === undefined ? NaN : value;
  }
  if (OPERATORS[node.name]) {
    return OPERATORS[node.name](
      evaluate(input(node, 0), env),
      evaluate(input(node, 1), env)
    );
  }
  if (node.name === "reportMonadic") {
    const fn = MONADIC[literalText(input(node, 0))];
    return fn ? fn(evaluate(input(node, 1), env)) : NaN;
  }
  const value = (env.reporters || {})[node.name];
  return value === undefined ? NaN : value;
}

// Expression patterns: each returns a function (node) => boolean
const pattern = {
  number: (value) => (node) => numberValue(node) === value,
  reporter: (name) => (node) => isBlock(node) && node.name === name,
  variable:
    (...names) =>
    (node) =>
      names.map(normalizeName).includes(variableName(node)),
  op: (name, left, right) => (node) =>
    isBlock(node) &&
    node.name === name &&
    left(input(node, 0)) &&
    right(input(node, 1)),
  // Same as op, with the operands in either order (+, ×)
  commutative: (name, left, right) => (node) =>
    isBlock(node) &&
    node.name === name &&
    ((left(input(node, 0)) && right(input(node, 1))) ||
      (left(input(node, 1)) && right(input(node, 0)))),
  anyOf:
    (...patterns) =>
    (node) =>
      patterns.some((p) => p(node)),
};

export default {
  inputs,
  input,
  isBlock,
  nextBlock,
  chain,
  scriptBody,
  bodySlots,
  bodies,
  walk,
  rootsOfSprites,
  normalizeName,
  literalText,
  numberValue,
  variableName,
  boolValue,
  comparison,
  evaluate,
  pattern,
};
