<template>
  <div class="design-table">
    <div v-if="block.title" class="text-center mb-1">{{ title }}</div>
    <p v-if="block.prompt" class="text-center mb-2">{{ prompt }}</p>

    <!-- Filled in by the student (slide 12) -->
    <div v-if="block.editable" class="table-scroll">
      <table class="table table-sm design-edit mb-0">
        <thead>
          <tr>
            <th scope="col">{{ headers[0] }}</th>
            <th v-for="(trial, t) in trials" :key="trial" scope="col">
              {{ headers[t + 1] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in rows" :key="r">
            <td>
              <select
                v-if="block.variableOptionsFrom"
                class="form-select form-select-sm"
                :aria-label="`Row ${r + 1}, ${headers[0] || 'first column'}`"
                :value="row.variable"
                :disabled="readOnly || !variableOptions.length"
                @change="setVariable(r, $event.target.value)"
              >
                <option value="" disabled>
                  {{
                    variableOptions.length ? "Select…" : "Answer earlier first"
                  }}
                </option>
                <option v-for="o in variableOptions" :key="o.id" :value="o.id">
                  {{ o.label }}
                </option>
              </select>
              <input
                v-else
                type="text"
                class="form-control form-control-sm"
                :aria-label="`Row ${r + 1}, ${headers[0] || 'first column'}`"
                :value="row.variable"
                :readonly="readOnly"
                @input="setVariable(r, $event.target.value, true)"
                @blur="$emit('leave')"
              />
            </td>
            <td v-for="trial in trials" :key="trial">
              <input
                type="text"
                class="form-control form-control-sm"
                :aria-label="`Row ${r + 1}, ${
                  headers[trials.indexOf(trial) + 1] || `column ${trial}`
                }`"
                :value="row.values[trial] || ''"
                :readonly="readOnly"
                @input="setTrial(r, trial, $event.target.value)"
                @blur="$emit('leave')"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <static-table
      v-else
      :table="{ rows: block.rows || [], trials, headers: block.headers }"
    />
  </div>
</template>

<script>
import {
  fillRefs,
  headersOf,
  optionsFrom,
  rowCountOf,
  trialsOf,
} from "../lesson";
import blockProps from "./blockProps";
import StaticTable from "./StaticTable.vue";

/**
 * A trial table. Read-only rows, or `editable` with rowCount rows the student
 * fills in, saved as { rows: [{ variable, values: { A, B } }] }.
 */
export default {
  name: "DesignTableBlock",
  components: { StaticTable },
  props: blockProps,
  emits: ["answer", "leave"],
  computed: {
    title() {
      return fillRefs(this.block.title, this.ctx);
    },
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
    trials() {
      return trialsOf(this.block);
    },
    headers() {
      return headersOf(this.block);
    },
    variableOptions() {
      return this.block.variableOptionsFrom
        ? optionsFrom(this.block.variableOptionsFrom, this.ctx)
        : [];
    },
    rows() {
      return this.rowsOf(this.value);
    },
  },
  methods: {
    rowsOf(answer) {
      const saved = (answer && answer.rows) || [];
      return Array.from({ length: rowCountOf(this.block) }, (_, i) => ({
        variable: (saved[i] && saved[i].variable) || "",
        values: { ...((saved[i] && saved[i].values) || {}) },
      }));
    },
    // Edits build on the live answer, not the last render's copy: two cells
    // can change before the next render (autofill), and neither may be lost.
    change(index, edit, typing) {
      const live = this.rowsOf(this.ctx.answers[this.block.id]);
      const rows = live.map((row, i) => (i === index ? edit(row) : row));
      this.$emit("answer", { rows }, typing);
    },
    setVariable(index, text, typing = false) {
      this.change(index, (row) => ({ ...row, variable: text }), typing);
    },
    setTrial(index, trial, text) {
      this.change(
        index,
        (row) => ({ ...row, values: { ...row.values, [trial]: text } }),
        true
      );
    },
  },
};
</script>

<style scoped>
.design-table {
  border: 2px solid var(--inq-soft-border, #cfc9df);
  border-radius: 8px;
  padding: 16px;
}
.table-scroll {
  overflow-x: auto;
}
.design-edit {
  min-width: 420px;
  text-align: center;
  font-size: 14px;
}
.design-edit thead th {
  background: var(--inq-ink, #2e2645);
  color: #fff;
  padding: 8px;
}
.design-edit tbody td {
  background: var(--inq-row2, #f5f3fa);
  padding: 6px;
}
.design-edit tbody tr:nth-child(odd) td {
  background: var(--inq-row1, #e9e5f2);
}
</style>
