<template>
  <div>
    <label v-if="block.prompt" :for="inputId" class="form-label">
      {{ prompt }}
    </label>
    <select
      :id="inputId"
      class="form-select"
      :value="value || ''"
      :disabled="readOnly"
      @change="$emit('answer', $event.target.value || null)"
    >
      <option value="" disabled>Select…</option>
      <option
        v-for="option in block.options"
        :key="option.id"
        :value="option.id"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script>
import { fillRefs } from "../lesson";
import blockProps from "./blockProps";

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
  },
};
</script>
