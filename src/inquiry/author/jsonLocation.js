/**
 * Strict JSON parsing that reports where an error is, and finding the text
 * range of a validator issue path like "pages/3/steps/0/blocks/2".
 */
import {
  findNodeAtLocation,
  parseTree,
  printParseErrorCode,
} from "jsonc-parser";

const STRICT = { disallowComments: true, allowTrailingComma: false };

const MESSAGES = {
  InvalidSymbol: "Unexpected character",
  InvalidNumberFormat: "Invalid number",
  PropertyNameExpected: "Expected a property name in double quotes",
  ValueExpected: "Expected a value",
  ColonExpected: "Expected a colon",
  CommaExpected: "Expected a comma",
  CloseBraceExpected: "Expected a closing }",
  CloseBracketExpected: "Expected a closing ]",
  EndOfFileExpected: "Unexpected text after the end",
  InvalidCommentToken: "Comments aren't allowed",
  UnexpectedEndOfComment: "Comments aren't allowed",
  UnexpectedEndOfString: "A string isn't closed",
  UnexpectedEndOfNumber: "A number is cut off",
  InvalidUnicode: "Invalid unicode escape",
  InvalidEscapeCharacter: "Invalid escape character",
  InvalidCharacter: "Invalid character in a string",
};

/** 1-based line of a text offset. */
export function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

/**
 * { value } for valid JSON, or { error: { message, offset, length, line } }
 * for the first syntax error.
 */
export function parseJson(text) {
  const errors = [];
  parseTree(text, errors, STRICT);
  if (errors.length) {
    const { error, offset, length } = errors[0];
    const code = printParseErrorCode(error);
    return {
      error: {
        message: MESSAGES[code] || code,
        offset,
        length: Math.max(length, 1),
        line: lineOf(text, offset),
      },
    };
  }
  return { value: JSON.parse(text) };
}

/**
 * The text range { offset, length } an issue path points at. Falls back to
 * the nearest parent that exists, e.g. the object missing a property.
 */
export function rangeOf(text, path) {
  const root = parseTree(text, [], STRICT);
  if (!root) return null;
  const segments = (path || "")
    .split("/")
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
  for (let n = segments.length; n >= 0; n--) {
    let node = findNodeAtLocation(root, segments.slice(0, n));
    if (!node) continue;
    // A property's value: include its key, so the selection reads naturally
    if (node.parent && node.parent.type === "property") node = node.parent;
    return { offset: node.offset, length: node.length };
  }
  return { offset: root.offset, length: root.length };
}
