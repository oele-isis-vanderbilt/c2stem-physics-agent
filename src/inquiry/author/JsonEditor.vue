<template>
  <div class="json-editor" :class="{ 'read-only': readOnly }">
    <pre ref="gutter" class="gutter" aria-hidden="true">{{ lineNumbers }}</pre>
    <textarea
      ref="text"
      class="code"
      :value="modelValue"
      :readonly="readOnly"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      :aria-label="label"
      wrap="off"
      @input="$emit('update:modelValue', $event.target.value)"
      @scroll="syncGutter"
      @keydown="keydown"
    ></textarea>
  </div>
</template>

<script>
import { lineOf } from "./jsonLocation";

const LINE_HEIGHT = 20; // matches the CSS

/**
 * A plain text box for lesson JSON with line numbers. Tab indents, Ctrl+S
 * emits save, and select(offset, length) shows a range.
 */
export default {
  name: "JsonEditor",
  props: {
    modelValue: { type: String, required: true },
    readOnly: { type: Boolean, default: false },
    label: { type: String, default: "Lesson JSON" },
  },
  emits: ["update:modelValue", "save"],
  computed: {
    lineNumbers() {
      const count = this.modelValue.split("\n").length;
      return Array.from({ length: count }, (_, i) => i + 1).join("\n");
    },
  },
  methods: {
    syncGutter() {
      this.$refs.gutter.scrollTop = this.$refs.text.scrollTop;
    },
    keydown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        this.$emit("save");
      } else if (event.key === "Tab" && !this.readOnly && !event.shiftKey) {
        event.preventDefault();
        // execCommand keeps the browser's undo history; fall back if it's gone
        if (!document.execCommand("insertText", false, "  ")) {
          const el = this.$refs.text;
          const { selectionStart: start, selectionEnd: end } = el;
          const text = this.modelValue;
          this.$emit(
            "update:modelValue",
            text.slice(0, start) + "  " + text.slice(end)
          );
          this.$nextTick(() => el.setSelectionRange(start + 2, start + 2));
        }
      }
    },
    /** Selects a range and scrolls it into view, a few lines from the top. */
    select(offset, length) {
      const el = this.$refs.text;
      el.focus({ preventScroll: true });
      el.setSelectionRange(offset, offset + length);
      const line = lineOf(this.modelValue, offset);
      el.scrollTop = Math.max(0, (line - 4) * LINE_HEIGHT);
      this.syncGutter();
    },
  },
};
</script>

<style scoped>
.json-editor {
  display: flex;
  height: 100%;
  border: 1px solid var(--inq-line, #ddd8ea);
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  font-family: SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 20px;
}
.gutter {
  flex: 0 0 auto;
  min-width: 3.5em;
  margin: 0;
  padding: 8px 8px 8px 0;
  overflow: hidden;
  text-align: right;
  color: #9a93ad;
  background: var(--inq-tint, #f4f2f9);
  border-right: 1px solid var(--inq-line, #ddd8ea);
  font: inherit;
  user-select: none;
}
.code {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 0;
  outline: none;
  resize: none;
  white-space: pre;
  overflow: auto;
  font: inherit;
  color: var(--inq-ink, #2e2645);
  tab-size: 2;
}
.code::selection {
  background: #d9d2f0;
}
.read-only .code {
  background: #fafafa;
  color: #555;
}
</style>
