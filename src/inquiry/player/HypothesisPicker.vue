<template>
  <div class="hyp-picker">
    <select
      class="form-select"
      aria-label="Hypothesis"
      :value="current"
      @change="$emit('update:current', $event.target.value)"
    >
      <option v-for="(item, i) in items" :key="item.id" :value="item.id">
        Hypothesis {{ i + 1 }}{{ done.includes(item.id) ? " ✓" : "" }}
      </option>
    </select>
    <span v-if="statement" class="hyp-statement">“{{ statement }}”</span>
  </div>
</template>

<script>
/**
 * Picks which hypothesis a step's questions are about. `items` are the
 * student's hypotheses; `done` the ids whose answers on this step are complete.
 */
export default {
  name: "HypothesisPicker",
  props: {
    items: { type: Array, required: true },
    current: { type: String, required: true },
    done: { type: Array, default: () => [] },
  },
  emits: ["update:current"],
  computed: {
    statement() {
      const item = this.items.find((i) => i.id === this.current);
      return item && item.statement;
    },
  },
};
</script>

<style scoped>
.hyp-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 1rem;
}
/* Same gap as between two blocks when it follows one */
.hyp-picker:not(:first-child) {
  margin-top: 1.25rem;
}
.hyp-picker .form-select {
  flex: 1 1 240px;
  max-width: 420px;
}
.hyp-statement {
  color: var(--inq-muted, #5c5670);
  font-size: 14px;
}
</style>
