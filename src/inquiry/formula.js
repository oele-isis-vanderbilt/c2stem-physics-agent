/**
 * Formulas for calculated lesson variables, e.g. "10 * velocityRatio".
 *
 * Arithmetic over numbers and slider names: + - * / ^ (power), unary minus and
 * brackets. Parsed into a small tree and worked out here, never with eval, so
 * a lesson can't run code. The service checks the same grammar in
 * app/formula.py; keep the two in step.
 */

const TOKEN = /\s*(?:(\d+(?:\.\d*)?|\.\d+)|([A-Za-z][A-Za-z0-9_]*)|(\S))/y;

export class FormulaError extends Error {}

function tokens(formula) {
  const list = [];
  TOKEN.lastIndex = 0;
  let match;
  while (TOKEN.lastIndex < formula.length && (match = TOKEN.exec(formula))) {
    const [, number, name, other] = match;
    if (number !== undefined) list.push({ kind: "number", text: number });
    else if (name !== undefined) list.push({ kind: "name", text: name });
    else if (other !== undefined) {
      if (!"+-*/^()".includes(other)) {
        throw new FormulaError(
          `“${other}” can't be used in a formula; use numbers, slider names, + - * / ^ and brackets.`
        );
      }
      list.push({ kind: "op", text: other });
    }
  }
  list.push({ kind: "end", text: "" });
  return list;
}

/** Parses a formula into a tree; throws FormulaError with a message for authors. */
export function parseFormula(formula) {
  const text = String(formula || "");
  if (!text.trim()) {
    throw new FormulaError("Give a formula, e.g. 10 * velocityRatio.");
  }
  const list = tokens(text);
  let at = 0;
  const peek = () => list[at];
  const isOp = (op) => peek().kind === "op" && peek().text === op;

  // expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary)*
  // unary := '-' unary | power ; power := primary ('^' unary)?
  // As in maths, -2 ^ 2 is -(2 ^ 2) and 2 ^ 3 ^ 2 is 2 ^ (3 ^ 2).
  function expr() {
    let node = term();
    while (isOp("+") || isOp("-")) {
      const op = list[at++].text;
      node = { op, left: node, right: term() };
    }
    return node;
  }
  function term() {
    let node = unary();
    while (isOp("*") || isOp("/")) {
      const op = list[at++].text;
      node = { op, left: node, right: unary() };
    }
    return node;
  }
  function unary() {
    if (isOp("-")) {
      at++;
      return { op: "neg", left: unary() };
    }
    return power();
  }
  function power() {
    const node = primary();
    if (isOp("^")) {
      at++;
      return { op: "^", left: node, right: unary() };
    }
    return node;
  }
  function primary() {
    const token = list[at++];
    if (token.kind === "number") return { number: parseFloat(token.text) };
    if (token.kind === "name") return { name: token.text };
    if (token.kind === "op" && token.text === "(") {
      const node = expr();
      if (list[at++].text !== ")") {
        throw new FormulaError("A bracket is opened but not closed.");
      }
      return node;
    }
    if (token.kind === "end")
      throw new FormulaError("The formula ends too soon.");
    throw new FormulaError(`“${token.text}” is in the wrong place.`);
  }

  const tree = expr();
  if (peek().kind !== "end") {
    throw new FormulaError(`“${peek().text}” is in the wrong place.`);
  }
  return tree;
}

/** The names a formula tree uses, each once, in order. */
export function namesIn(tree, found = []) {
  if (!tree) return found;
  if (tree.name !== undefined) {
    if (!found.includes(tree.name)) found.push(tree.name);
  } else if (tree.op) {
    namesIn(tree.left, found);
    namesIn(tree.right, found);
  }
  return found;
}

/**
 * Works out a tree with { name: number }. Returns null when a name has no
 * number or the result isn't a finite number (e.g. dividing by zero).
 */
export function evaluate(tree, values) {
  const run = (node) => {
    if (node.number !== undefined) return node.number;
    if (node.name !== undefined) {
      const v = values[node.name];
      return typeof v === "number" ? v : parseFloat(v);
    }
    const a = run(node.left);
    if (node.op === "neg") return -a;
    const b = run(node.right);
    switch (node.op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return a / b;
      default:
        return a ** b;
    }
  };
  const result = run(tree);
  return Number.isFinite(result) ? result : null;
}

/** Works out a formula string; null if it can't be read or worked out. */
export function calculate(formula, values) {
  try {
    return evaluate(parseFormula(formula), values);
  } catch (e) {
    if (e instanceof FormulaError) return null;
    throw e;
  }
}

/**
 * Checks a calculated variable's formula against the lesson's sliders, for
 * the authoring form: { ok, message, names }. `sliders` is [{ key, label }].
 */
export function checkFormula(formula, sliders) {
  let names;
  try {
    names = namesIn(parseFormula(formula));
  } catch (e) {
    if (!(e instanceof FormulaError)) throw e;
    return { ok: false, message: e.message, names: [] };
  }
  const keys = sliders.map((s) => s.key);
  const unknown = names.filter((n) => !keys.includes(n));
  if (unknown.length) {
    return {
      ok: false,
      names,
      message: `“${unknown[0]}” isn't a slider. Sliders you can use: ${
        keys.join(", ") || "none yet"
      }.`,
    };
  }
  return { ok: true, names, message: "" };
}

// Names and numbers, so a name is only ever matched whole ("mass" not in "mass2")
const WORDS = /[A-Za-z][A-Za-z0-9_]*|\d+(?:\.\d*)?|\.\d+/g;

/** A formula with one slider name changed, e.g. after renaming a variable. */
export function renameInFormula(formula, from, to) {
  return String(formula || "").replace(WORDS, (word) =>
    word === from ? to : word
  );
}

/** Whether a formula mentions a name, even if the formula can't be read yet. */
export function formulaMentions(formula, name) {
  return (String(formula || "").match(WORDS) || []).includes(name);
}
