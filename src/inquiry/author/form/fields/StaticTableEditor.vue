<template>
  <div class="static-table">
    <div class="table-scroll">
      <table class="table table-sm align-middle mb-1">
        <thead>
          <tr>
            <th scope="col">Row</th>
            <th v-for="(trial, t) in trials" :key="t" scope="col">
              <span class="trial-head">
                <input
                  type="text"
                  class="form-control form-control-sm"
                  :class="{ 'is-invalid': invalid('trials') }"
                  :aria-label="`Trial ${t + 1} name`"
                  :value="trial"
                  @change="renameTrial(t, $event.target.value)"
                />
                <button
                  type="button"
                  class="tool tool-remove"
                  :disabled="trials.length <= 2"
                  :aria-label="`Remove trial ${trial}`"
                  title="Remove trial"
                  @click="removeTrial(t)"
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
                :value="row.label"
                @input="setLabel(r, $event.target.value)"
              />
            </td>
            <td v-for="trial in trials" :key="trial">
              <input
                type="text"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': invalid(`rows/${r}/values`) }"
                :aria-label="`${row.label || `Row ${r + 1}`}, trial ${trial}`"
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
      @click="addTrial"
    >
      + Add trial
    </button>
  </div>
</template>

<script>
import RowTools from "./RowTools.vue";
import { trialsOf } from "../../../player/lesson";

/**
 * A read-only table: trial columns (A and B unless renamed) and rows of
 * typed values. Emits edit(fn(table), boundary).
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
    /** Names every trial explicitly, since the default A, B is implied. */
    withTrials(fn) {
      const trials = [...this.trials];
      this.edit((table) => {
        table.trials = trials;
        fn(table);
      });
    },
    renameTrial(t, name) {
      const from = this.trials[t];
      const to = name.trim();
      if (!to || to === from || this.trials.includes(to)) return;
      this.withTrials((table) => {
        table.trials[t] = to;
        for (const row of table.rows || []) {
          if (row.values && from in row.values) {
            const values = {};
            for (const [k, v] of Object.entries(row.values)) {
              values[k === from ? to : k] = v;
            }
            row.values = values;
          }
        }
      });
    },
    addTrial() {
      let n = this.trials.length;
      let name;
      do {
        name =
          String.fromCharCode(65 + (n % 26)) +
          (n >= 26 ? Math.floor(n / 26) : "");
        n += 1;
      } while (this.trials.includes(name));
      this.withTrials((table) => table.trials.push(name));
    },
    removeTrial(t) {
      const name = this.trials[t];
      this.withTrials((table) => {
        table.trials.splice(t, 1);
        for (const row of table.rows || []) {
          if (row.values) delete row.values[name];
        }
      });
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
