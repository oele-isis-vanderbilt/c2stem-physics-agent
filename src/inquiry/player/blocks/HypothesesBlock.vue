<template>
  <div>
    <p v-if="block.prompt" class="mb-2">{{ prompt }}</p>

    <!-- Several hypotheses: pick which one to work on -->
    <div v-if="several" class="hyp-picker">
      <select
        class="form-select"
        aria-label="Hypothesis"
        :value="current.id"
        @change="active = $event.target.value"
      >
        <option v-for="(item, i) in items" :key="item.id" :value="item.id">
          Hypothesis {{ i + 1 }}{{ done(item) ? " ✓" : "" }}
        </option>
      </select>
      <template v-if="!readOnly">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="items.length >= max"
          @click="add"
        >
          + Add hypothesis
        </button>
        <button
          v-if="items.length > min"
          type="button"
          class="btn btn-sm btn-link"
          @click="remove"
        >
          Remove this hypothesis
        </button>
      </template>
    </div>

    <div :class="several ? 'hyp-box' : null">
      <p v-if="asksStatement" class="hyp-line">
        <label :for="`${uid}-statement`">My hypothesis is:</label>
        <input
          :id="`${uid}-statement`"
          type="text"
          class="form-control"
          :value="current.statement"
          :readonly="readOnly"
          @input="update({ statement: $event.target.value }, true)"
          @blur="$emit('leave')"
        />
      </p>
      <p class="hyp-line">
        <label :for="`${uid}-iv`">My independent variable is:</label>
        <select
          :id="`${uid}-iv`"
          class="form-select"
          :value="current.iv"
          :disabled="readOnly"
          @change="setIndependent($event.target.value)"
        >
          <option value="" disabled>Select…</option>
          <option v-for="o in block.ivOptions" :key="o.id" :value="o.id">
            {{ o.label }}
          </option>
        </select>
      </p>
      <p class="hyp-line">
        <label :for="`${uid}-dv`">My dependent variable is:</label>
        <select
          :id="`${uid}-dv`"
          class="form-select"
          :value="current.dv"
          :disabled="readOnly"
          @change="update({ dv: $event.target.value })"
        >
          <option value="" disabled>Select…</option>
          <option v-for="o in block.dvOptions" :key="o.id" :value="o.id">
            {{ o.label }}
          </option>
        </select>
      </p>
      <p class="hyp-line">
        <label :for="`${uid}-cv`">
          {{
            two ? "My controlled variables are:" : "My controlled variable is:"
          }}
        </label>
        <select
          :id="`${uid}-cv`"
          class="form-select"
          :value="current.cv"
          :disabled="readOnly || !current.iv"
          @change="update({ cv: $event.target.value })"
        >
          <option value="" disabled>
            {{
              current.iv ? "Select…" : "Choose the independent variable first"
            }}
          </option>
          <option v-for="o in controlled" :key="o.id" :value="o.id">
            {{ o.label }}
          </option>
        </select>
        <template v-if="two">
          <span class="and">and</span>
          <select
            :id="`${uid}-cv2`"
            class="form-select"
            aria-label="My second controlled variable"
            :value="current.cv2"
            :disabled="readOnly || !current.iv"
            @change="update({ cv2: $event.target.value })"
          >
            <option value="" disabled>
              {{
                current.iv ? "Select…" : "Choose the independent variable first"
              }}
            </option>
            <option v-for="o in controlled2" :key="o.id" :value="o.id">
              {{ o.label }}
            </option>
          </select>
        </template>
      </p>
    </div>
  </div>
</template>

<script>
import {
  asksStatement,
  controlledCountOf,
  controlledOptions,
  fillRefs,
  hypothesesOf,
  hypothesisDone,
  maxHypothesesOf,
  minHypothesesOf,
  newHypothesisId,
} from "../lesson";
import { reactive } from "vue";
import blockProps from "./blockProps";

/**
 * One or more hypotheses, each with its own independent, dependent and
 * controlled variable (two with controlledCount: 2, saved as cv and cv2).
 * Saves { items: [{ id, statement, iv, dv, cv, cv2 }] }; the
 * variables are option ids. The controlled variable is picked from the
 * independent-variable options the student didn't choose as independent.
 */
export default {
  name: "HypothesesBlock",
  props: blockProps,
  emits: ["answer", "leave"],
  inject: {
    // The hypothesis picked, shared with the lesson's other pages
    hypothesisFocus: { default: () => reactive({}) },
  },
  computed: {
    active: {
      get() {
        return this.hypothesisFocus[this.block.key || this.block.id] || null;
      },
      set(id) {
        this.hypothesisFocus[this.block.key || this.block.id] = id;
      },
    },
    uid() {
      return `inquiry-${this.block.id}`;
    },
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
    asksStatement() {
      return asksStatement(this.block);
    },
    min() {
      return minHypothesesOf(this.block);
    },
    max() {
      return maxHypothesesOf(this.block);
    },
    several() {
      return this.max > 1;
    },
    items() {
      return hypothesesOf(this.block, this.value);
    },
    current() {
      return this.items.find((i) => i.id === this.active) || this.items[0];
    },
    two() {
      return controlledCountOf(this.block) === 2;
    },
    controlled() {
      return controlledOptions(this.block, this.current, 1);
    },
    controlled2() {
      return controlledOptions(this.block, this.current, 2);
    },
  },
  methods: {
    done(item) {
      return hypothesisDone(this.block, item);
    },
    // Edits build on the live answer, not the last render's copy, so two
    // quick changes can't undo each other.
    live() {
      return hypothesesOf(this.block, this.ctx.answers[this.block.id]);
    },
    save(items, typing = false) {
      this.$emit("answer", { items }, typing);
    },
    update(fields, typing = false) {
      const id = this.current.id;
      this.save(
        this.live().map((item) =>
          item.id === id ? { ...item, ...fields } : item
        ),
        typing
      );
    },
    setIndependent(iv) {
      // A variable can't be both independent and controlled
      const fields = { iv };
      if (this.current.cv === iv) fields.cv = "";
      if (this.current.cv2 === iv) fields.cv2 = "";
      this.update(fields);
    },
    add() {
      const items = this.live();
      if (items.length >= this.max) return;
      const id = newHypothesisId(items);
      this.save([
        ...items,
        { id, statement: "", iv: "", dv: "", cv: "", cv2: "" },
      ]);
      this.active = id;
    },
    remove() {
      const items = this.live();
      const index = items.findIndex((i) => i.id === this.current.id);
      if (items.length <= this.min || index < 0) return;
      const rest = items.filter((_, i) => i !== index);
      this.save(rest);
      this.active = rest[Math.max(0, index - 1)].id;
    },
  },
};
</script>

<style scoped>
.hyp-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.hyp-picker .form-select {
  flex: 1 1 240px;
  max-width: 420px;
}
.hyp-box {
  border: 1.5px solid var(--inq-ink, #2e2645);
  border-radius: 6px;
  padding: 16px;
}
.hyp-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 0.75rem;
}
.hyp-line:last-child {
  margin-bottom: 0;
}
.hyp-line label {
  margin: 0;
}
.hyp-line .and {
  color: var(--inq-muted, #5c5670);
}
.hyp-line .form-control,
.hyp-line .form-select {
  flex: 1 1 240px;
  min-width: 0;
}
</style>
