<template>
  <div class="trial-table">
    <p v-if="!source" class="text-muted mb-0">
      This table needs the hypotheses from an earlier step.
    </p>
    <template v-else>
      <!-- One table per hypothesis: pick which one to fill in -->
      <div v-if="source.items.length > 1" class="hyp-picker">
        <select
          class="form-select"
          aria-label="Hypothesis"
          :value="current.id"
          @change="active = $event.target.value"
        >
          <option
            v-for="(item, i) in source.items"
            :key="item.id"
            :value="item.id"
          >
            Hypothesis {{ i + 1 }}{{ done(item) ? " ✓" : "" }}
          </option>
        </select>
        <span v-if="current.statement" class="hyp-statement">
          “{{ current.statement }}”
        </span>
      </div>

      <div class="design-box">
        <div v-if="block.title" class="text-center mb-2">{{ title }}</div>
        <p v-if="block.prompt" class="mb-2">{{ prompt }}</p>

        <p class="compare">
          <label :for="`${uid}-compare`">{{ comparePrompt }}</label>
          <select
            :id="`${uid}-compare`"
            class="form-select"
            :value="table.compare"
            :disabled="readOnly"
            @change="setCompare($event.target.value)"
          >
            <option value="" disabled>Select…</option>
            <option
              v-for="o in source.block.dvOptions"
              :key="o.id"
              :value="o.id"
            >
              {{ o.label }}
            </option>
          </select>
        </p>

        <div class="table-scroll">
          <table class="table table-sm trials mb-0">
            <thead>
              <tr>
                <th scope="col">Trial</th>
                <th
                  v-for="column in columns"
                  :key="column.id"
                  scope="col"
                  :class="{ chosen: column.id === current.iv }"
                >
                  {{ column.label }}
                  <small v-if="column.unit">({{ column.unit }})</small>
                </th>
                <th v-if="removable" scope="col">
                  <span class="visually-hidden">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, r) in table.trials" :key="r">
                <th scope="row">Trial {{ r + 1 }}</th>
                <td
                  v-for="column in columns"
                  :key="column.id"
                  :class="{ chosen: column.id === current.iv }"
                >
                  <input
                    type="text"
                    inputmode="decimal"
                    class="form-control form-control-sm"
                    :aria-label="`Trial ${r + 1}, ${column.label}`"
                    :value="row[column.id] ?? ''"
                    :readonly="readOnly"
                    @input="setCell(r, column.id, $event)"
                    @blur="$emit('leave')"
                  />
                </td>
                <td v-if="removable">
                  <button
                    v-if="r >= minTrials"
                    type="button"
                    class="btn btn-sm btn-link remove"
                    :aria-label="`Remove trial ${r + 1}`"
                    @click="removeTrial(r)"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!readOnly" class="table-tools">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="table.trials.length >= maxTrials"
            @click="addTrial"
          >
            + Add trial
          </button>
          <span class="text-muted small">
            {{ table.trials.length }} of up to {{ maxTrials }} trials · numbers
            only
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import {
  fillRefs,
  maxTrialsOf,
  minTrialsOf,
  tableDone,
  tableFor,
  tableSource,
} from "../lesson";
import blockProps from "./blockProps";

// What may be typed in a cell: a number, or the start of one
const PARTIAL_NUMBER = /^-?\d*\.?\d*$/;

/**
 * The trial table for each hypothesis of an earlier Hypotheses block
 * (hypothesesFrom). Rows are trials, columns that block's independent-variable
 * options, and the compare dropdown its dependent-variable options. Saves
 * { byHypothesis: { [hypothesisId]: { compare, trials: [{ [optionId]: "1.5" }] } } }.
 */
export default {
  name: "TrialTableBlock",
  props: blockProps,
  emits: ["answer", "leave"],
  data() {
    return { active: null };
  },
  computed: {
    uid() {
      return `inquiry-${this.block.id}`;
    },
    title() {
      return fillRefs(this.block.title, this.ctx);
    },
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
    comparePrompt() {
      return this.block.comparePrompt || "We compare the resulting values of:";
    },
    source() {
      return tableSource(this.block, this.ctx);
    },
    current() {
      const items = this.source.items;
      return items.find((i) => i.id === this.active) || items[0];
    },
    table() {
      return tableFor(this.block, this.value, this.current.id);
    },
    minTrials() {
      return minTrialsOf(this.block);
    },
    maxTrials() {
      return maxTrialsOf(this.block);
    },
    removable() {
      return !this.readOnly && this.table.trials.length > this.minTrials;
    },
    columns() {
      // An option named after a lesson variable shows that variable's unit
      const variables = (this.ctx.lesson && this.ctx.lesson.variables) || [];
      return this.source.block.ivOptions.map((o) => {
        const variable = variables.find((v) => v.key === o.id);
        return { ...o, unit: variable && variable.unit };
      });
    },
  },
  methods: {
    done(item) {
      return tableDone(this.block, this.value, this.source, item.id);
    },
    // Edits build on the live answer, not the last render's copy, so two
    // quick changes can't undo each other.
    change(edit, typing = false) {
      const live = this.ctx.answers[this.block.id];
      const id = this.current.id;
      const table = edit(tableFor(this.block, live, id));
      const byHypothesis = { ...((live && live.byHypothesis) || {}) };
      byHypothesis[id] = table;
      this.$emit("answer", { byHypothesis }, typing);
    },
    setCompare(compare) {
      this.change((table) => ({ ...table, compare }));
    },
    setCell(index, columnId, event) {
      const text = event.target.value.trim();
      if (!PARTIAL_NUMBER.test(text)) {
        // Not a number: put back what was there
        const row = this.table.trials[index] || {};
        event.target.value = row[columnId] ?? "";
        return;
      }
      this.change((table) => {
        const trials = table.trials.map((row, i) => {
          if (i !== index) return row;
          const next = { ...row };
          if (text === "") delete next[columnId];
          else next[columnId] = text;
          return next;
        });
        return { ...table, trials };
      }, true);
    },
    addTrial() {
      this.change((table) =>
        table.trials.length >= this.maxTrials
          ? table
          : { ...table, trials: [...table.trials, {}] }
      );
    },
    removeTrial(index) {
      this.change((table) => ({
        ...table,
        trials: table.trials.filter((_, i) => i !== index),
      }));
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
  margin-bottom: 10px;
}
.hyp-picker .form-select {
  flex: 1 1 240px;
  max-width: 420px;
}
.hyp-statement {
  color: var(--inq-muted, #5c5670);
  font-size: 14px;
}
.design-box {
  border: 2px solid var(--inq-soft-border, #cfc9df);
  border-radius: 8px;
  padding: 16px;
}
.compare {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 12px;
}
.compare label {
  margin: 0;
}
.compare .form-select {
  flex: 1 1 220px;
  max-width: 360px;
}
.table-scroll {
  overflow-x: auto;
}
.trials {
  min-width: 360px;
  text-align: center;
  font-size: 14px;
}
.trials thead th {
  background: var(--inq-ink, #2e2645);
  color: #fff;
  padding: 8px;
  vertical-align: middle;
}
.trials thead th small {
  display: block;
  font-weight: 400;
  opacity: 0.8;
}
.trials tbody th,
.trials tbody td {
  background: var(--inq-row2, #f5f3fa);
  padding: 6px;
  vertical-align: middle;
}
.trials tbody tr:nth-child(odd) th,
.trials tbody tr:nth-child(odd) td {
  background: var(--inq-row1, #e9e5f2);
}
.trials tbody th {
  white-space: nowrap;
  width: 1%;
}
.trials .form-control {
  text-align: center;
  min-width: 70px;
}
/* The column of this hypothesis's independent variable */
.trials td.chosen .form-control {
  border: 2px solid #2a9bd6;
}
.trials thead th.chosen {
  box-shadow: inset 0 -3px 0 #2a9bd6;
}
.remove {
  text-decoration: none;
  padding: 0 6px;
}
.table-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
</style>
