<template>
  <div>
    <p v-if="block.prompt" class="mb-2">{{ prompt }}</p>

    <!-- Options with a table or prompt are radio cards (slide 4) -->
    <div v-if="asCards" class="row g-3">
      <div
        v-for="option in block.options"
        :key="option.id"
        class="col-12 col-md-6"
      >
        <div
          class="choice-card"
          :class="{ selected: value === option.id, locked: readOnly }"
          @click="onCardClick($event, option.id)"
        >
          <div class="choice-head">
            <input
              :id="optionId(option)"
              type="radio"
              :name="groupName"
              :value="option.id"
              :checked="value === option.id"
              :disabled="readOnly"
              @change="pick(option.id)"
            />
            <label :for="optionId(option)">{{ option.label }}</label>
          </div>
          <p v-if="option.prompt" class="choice-prompt">
            {{ option.prompt }}
          </p>
          <static-table v-if="option.table" :table="option.table" />
        </div>
      </div>
    </div>

    <div v-else class="d-flex flex-wrap gap-2">
      <button
        v-for="option in block.options"
        :key="option.id"
        type="button"
        class="btn choice-btn"
        :class="{ selected: value === option.id }"
        :aria-pressed="value === option.id"
        :disabled="readOnly"
        @click="pick(option.id)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script>
import { fillRefs } from "../lesson";
import blockProps from "./blockProps";
import StaticTable from "./StaticTable.vue";

export default {
  name: "ChoiceBlock",
  components: { StaticTable },
  props: blockProps,
  emits: ["answer"],
  computed: {
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
    asCards() {
      return this.block.options.some((o) => o.table || o.prompt);
    },
    groupName() {
      return `inquiry-${this.block.id}`;
    },
  },
  methods: {
    optionId(option) {
      return `inquiry-${this.block.id}-${option.id}`;
    },
    pick(optionId) {
      if (!this.readOnly) this.$emit("answer", optionId);
    },
    // The whole card picks the option; the radio and its label handle themselves.
    onCardClick(event, optionId) {
      if (event.target.closest("input, label")) return;
      this.pick(optionId);
    },
  },
};
</script>

<style scoped>
.choice-card {
  height: 100%;
  background: #fff;
  border: 2px solid var(--inq-soft-border, #cfc9df);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
}
.choice-card:hover:not(.locked) {
  border-color: var(--inq-purple, #615195);
}
.choice-card.selected {
  border: 3px solid var(--inq-purple, #615195);
  background: var(--inq-tint, #f4f2f9);
  padding: 15px;
}
.choice-card.locked {
  cursor: default;
}
.choice-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.choice-head input {
  width: 20px;
  height: 20px;
  accent-color: var(--inq-purple, #615195);
}
.choice-head label {
  font-weight: 600;
  font-size: 18px;
  cursor: inherit;
}
.choice-prompt {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--inq-muted, #5c5670);
}
.choice-btn {
  border: 2px solid var(--inq-purple, #615195);
  color: var(--inq-purple, #615195);
  background: #fff;
  border-radius: 8px;
}
.choice-btn:hover:not(:disabled) {
  background: var(--inq-tint, #f4f2f9);
}
.choice-btn.selected {
  background: var(--inq-purple, #615195);
  color: #fff;
}
.choice-btn:disabled {
  opacity: 1;
}
</style>
