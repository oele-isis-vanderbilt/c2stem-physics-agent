<template>
  <div class="static-table">
    <div class="table-scroll">
      <table class="table table-sm align-middle mb-1">
        <thead>
          <tr>
            <th scope="col">
              <input
                type="text"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': invalid('headers') }"
                aria-label="First column heading"
                placeholder="Heading"
                :value="headers[0]"
                @input="header(0, $event.target.value)"
              />
            </th>
            <th v-for="(trial, t) in trials" :key="trial" scope="col">
              <span class="trial-head">
                <input
                  type="text"
                  class="form-control form-control-sm"
                  :class="{ 'is-invalid': invalid('headers') }"
                  :aria-label="`Column ${t + 2} heading`"
                  placeholder="Heading"
                  :value="headers[t + 1]"
                  @input="header(t + 1, $event.target.value)"
                />
                <button
                  type="button"
                  class="tool"
                  :disabled="t === 0"
                  :aria-label="`Move column ${t + 2} left`"
                  title="Move left"
                  @click="column((table) => moveColumn(table, t, -1))"
                >
                  ←
                </button>
                <button
                  type="button"
                  class="tool"
                  :disabled="t === trials.length - 1"
                  :aria-label="`Move column ${t + 2} right`"
                  title="Move right"
                  @click="column((table) => moveColumn(table, t, 1))"
                >
                  →
                </button>
                <button
                  type="button"
                  class="tool tool-remove"
                  :disabled="trials.length <= 1"
                  :aria-label="`Remove column ${t + 2}`"
                  title="Remove column"
                  @click="column((table) => removeColumn(table, t))"
                >
                  ✕
                </button>
              </span>
            </th>
            <th scope="col"><span class="visually-hidden">Row tools</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in rows" :key="r">
            <td>
              <input
                type="text"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': invalid(`rows/${r}/label`) }"
                :aria-label="`Row ${r + 1} label`"
                placeholder="Label"
                :value="row.label"
                @input="setLabel(r, $event.target.value)"
              />
            </td>
            <td v-for="trial in trials" :key="trial">
              <input
                type="text"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': invalid(`rows/${r}/values`) }"
                :aria-label="`${row.label || `Row ${r + 1}`}, ${
                  headers[trials.indexOf(trial) + 1] || `column ${trial}`
                }`"
                placeholder="Value"
                :value="valueOf(row, trial)"
                @input="setValue(r, trial, $event.target.value)"
              />
            </td>
            <td>
              <row-tools
                :index="r"
                :count="rows.length"
                :can-remove="rows.length > 1"
                :what="`row ${r + 1}`"
                @move="(dir) => moveRow(r, dir)"
                @remove="removeRow(r)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="btn btn-sm btn-link add-link" @click="addRow">
      + Add row
    </button>
    <button
      type="button"
      class="btn btn-sm btn-link add-link"
      @click="column(addColumn)"
    >
      + Add column
    </button>
  </div>
</template>

<script>
import RowTools from "./RowTools.vue";
import { headersOf, trialsOf } from "../../../player/lesson";
import { addColumn, moveColumn, removeColumn, setHeader } from "../../draft";

/**
 * A read-only table: headings, value columns and rows, all typed by the
 * author and allowed to be blank. Emits edit(fn(table), boundary).
 */
export default {
  name: "StaticTableEditor",
  components: { RowTools },
  props: {
    table: { type: Object, required: true },
    invalid: { type: Function, default: () => false }, // path inside the table
  },
  emits: ["edit"],
  computed: {
    trials() {
      return trialsOf(this.table);
    },
    headers() {
      return headersOf(this.table);
    },
    rows() {
      return (Array.isArray(this.table.rows) ? this.table.rows : []).filter(
        (row) => row && typeof row === "object"
      );
    },
  },
  methods: {
    edit(fn, boundary = true) {
      this.$emit("edit", fn, boundary);
    },
    valueOf(row, trial) {
      const value = row.values && row.values[trial];
      return value === undefined || value === null ? "" : String(value);
    },
    setLabel(r, label) {
      this.edit((table) => {
        table.rows[r].label = label;
      }, false);
    },
    setValue(r, trial, text) {
      this.edit((table) => {
        const row = table.rows[r];
        const old = row.values ? row.values[trial] : undefined;
        // Numbers stay numbers when they still read as one
        const number = Number(text);
        row.values = {
          ...row.values,
          [trial]:
            typeof old === "number" &&
            text.trim() !== "" &&
            Number.isFinite(number)
              ? number
              : text,
        };
      }, false);
    },
    addColumn,
    moveColumn,
    removeColumn,
    header(i, text) {
      this.edit((table) => setHeader(table, i, text), false);
    },
    /** A change to the columns, as its own undo step. */
    column(fn) {
      this.edit(fn);
    },
    addRow() {
      const values = Object.fromEntries(this.trials.map((t) => [t, ""]));
      this.edit((table) => {
        table.rows = [...(table.rows || []), { label: "", values }];
      });
    },
    moveRow(r, dir) {
      this.edit((table) => {
        const [row] = table.rows.splice(r, 1);
        table.rows.splice(r + dir, 0, row);
      });
    },
    removeRow(r) {
      this.edit((table) => table.rows.splice(r, 1));
    },
  },
};
</script>
