import { marked } from "marked";
import DOMPurify from "dompurify";

/** Lesson markdown to HTML, with anything unsafe removed. */
export function renderMarkdown(md) {
  return DOMPurify.sanitize(marked.parse(md || "", { async: false }));
}

/** Makes a student's answer show as typed when inserted into markdown. */
export function escapeMarkdown(text) {
  return text
    .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
    .replace(/[\\`*_{}[\]()#+\-.!|~]/g, "\\$&");
}
