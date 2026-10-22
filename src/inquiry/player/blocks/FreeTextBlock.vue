<template>
  <div>
    <label v-if="block.prompt" :for="inputId" class="form-label">
      {{ prompt }}
    </label>
    <textarea
      :id="inputId"
      class="form-control"
      :rows="block.rows || 3"
      :placeholder="block.placeholder"
      :value="text"
      :readonly="readOnly"
      @input="update($event.target.value)"
      @blur="$emit('leave')"
    ></textarea>
  </div>
</template>

<script>
import { reactive } from "vue";
import { fillRefs, hypothesisSource, textFor } from "../lesson";
import blockProps from "./blockProps";

/**
 * A text box. With hypothesesFrom it is answered once per hypothesis of that
 * Hypotheses block, saved as { byHypothesis: { h1: "…" } }; the player shows
 * the hypothesis selector above the step's questions.
 */
export default {
  name: "FreeTextBlock",
  inject: {
    hypothesisFocus: { default: () => reactive({}) },
  },
  props: blockProps,
  emits: ["answer", "leave"],
  computed: {
    inputId() {
      return `inquiry-${this.block.id}`;
    },
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
    source() {
      return this.block.hypothesesFrom
        ? hypothesisSource(this.block, this.ctx)
        : null;
    },
    /** The hypothesis being answered, when answered per hypothesis. */
    hypothesisId() {
      if (!this.source) return null;
      const picked = this.hypothesisFocus[this.block.hypothesesFrom];
      const items = this.source.items;
      return items.some((i) => i.id === picked) ? picked : items[0].id;
    },
    text() {
      if (this.hypothesisId) return textFor(this.value, this.hypothesisId);
      return typeof this.value === "string" ? this.value : "";
    },
  },
  methods: {
    update(text) {
      if (!this.hypothesisId) {
        this.$emit("answer", text, true);
        return;
      }
      // Build on the live answer, so another hypothesis's text is kept
      const live = this.ctx.answers[this.block.id];
      const byHypothesis = { ...((live && live.byHypothesis) || {}) };
      byHypothesis[this.hypothesisId] = text;
      this.$emit("answer", { byHypothesis }, true);
    },
  },
};
</script>
