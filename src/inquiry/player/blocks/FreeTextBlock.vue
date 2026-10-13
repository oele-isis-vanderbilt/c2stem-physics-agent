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
      :value="value || ''"
      :readonly="readOnly"
      @input="$emit('answer', $event.target.value, true)"
      @blur="$emit('leave')"
    ></textarea>
  </div>
</template>

<script>
import { fillRefs } from "../lesson";
import blockProps from "./blockProps";

export default {
  name: "FreeTextBlock",
  props: blockProps,
  emits: ["answer", "leave"],
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
