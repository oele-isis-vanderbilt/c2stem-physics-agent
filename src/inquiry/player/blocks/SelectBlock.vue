<template>
  <div>
    <label v-if="block.prompt" :for="inputId" class="form-label">
      {{ prompt }}
    </label>
    <select
      :id="inputId"
      class="form-select"
      :value="value || ''"
      :disabled="readOnly || !options.length"
      @change="$emit('answer', $event.target.value || null)"
    >
      <option value="" disabled>
        {{ options.length ? "Select…" : "Answer the earlier questions first" }}
      </option>
      <option v-for="option in options" :key="option.id" :value="option.id">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script>
import { fillRefs, optionsFrom } from "../lesson";
import blockProps from "./blockProps";

/** A dropdown of fixed options, or of the student's earlier answers. */
export default {
  name: "SelectBlock",
  props: blockProps,
  emits: ["answer"],
  computed: {
    inputId() {
      return `inquiry-${this.block.id}`;
    },
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
    options() {
      return this.block.optionsFrom
        ? optionsFrom(this.block.optionsFrom, this.ctx)
        : this.block.options;
    },
  },
};
</script>
