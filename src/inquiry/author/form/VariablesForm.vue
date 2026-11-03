<template>
  <div class="variables-form">
    <p class="field-hint mb-3">
      Inputs are the sliders students set; outputs are what the simulation
      measures. Link each one to the project under Physics project. Calculated
      values are worked out from the sliders with a formula, e.g. to show Cart
      B's mass under a mass-ratio slider.
    </p>
    <p v-if="!variables.length" class="field-hint">No variables yet.</p>

    <ol class="list-unstyled">
      <li
        v-for="(v, i) in variables"
        :key="i"
        class="variable-card"
        :class="{ 'is-invalid': invalid(`variables/${i}`) }"
      >
        <div class="variable-head">
          <strong>{{ v.label || v.key || "New variable" }}</strong>
          <span class="role-badge" :class="`role-${v.role}`">{{ v.role }}</span>
          <row-tools
            :index="i"
            :count="variables.length"
            :what="`variable ${v.label || v.key}`"
            @move="(dir) => move(i, dir)"
            @remove="remove(v)"
          />
        </div>
        <div class="variable-grid">
          <key-field
            :ref="(el) => (keyFields[i] = el)"
            label="Name"
            :model-value="v.key || ''"
            :uses="usesOf(v.key).length"
            :taken="otherKeys(v.key)"
            taken-message="Another variable has this name."
            :hint="
              v.role === 'calculated'
                ? 'Worked out from its formula, not linked to the project.'
                : 'Links the variable to the project and to Simulation blocks.'
            "
            :invalid="invalid(`variables/${i}/key`)"
            @commit="(key) => rename(i, v.key, key)"
          />
          <text-field
            label="Label"
            :model-value="v.label || ''"
            :invalid="invalid(`variables/${i}/label`)"
            @update:model-value="(text) => setField(i, 'label', text, true)"
          />
          <text-field
            label="Unit"
            :model-value="v.unit || ''"
            placeholder="kg, m/s, …"
            @update:model-value="(text) => setField(i, 'unit', text)"
          />
          <div class="field">
            <div class="field-label">
              <label :for="`role-${i}`">Kind</label>
            </div>
            <select
              :id="`role-${i}`"
              class="form-select"
              :value="v.role"
              @change="setRole(v.key, $event.target.value)"
            >
              <option value="input">Input (slider)</option>
              <option value="output">Output (measured)</option>
              <option value="calculated">Calculated (from sliders)</option>
            </select>
          </div>
          <template v-if="v.role === 'input'">
            <div v-for="f in numberFields" :key="f.field" class="field">
              <div class="field-label">
                <label :for="`${f.field}-${i}`">{{ f.label }}</label>
              </div>
              <input
                :id="`${f.field}-${i}`"
                type="number"
                step="any"
                class="form-control"
                :class="{ 'is-invalid': invalid(`variables/${i}/${f.field}`) }"
                :value="v[f.field]"
                @change="setNumber(i, f.field, $event.target.value)"
              />
            </div>
          </template>
          <div v-if="v.role === 'calculated'" class="variable-wide">
            <text-field
              label="Formula"
              :model-value="v.formula || ''"
              placeholder="e.g. 10 * velocityRatio"
              :invalid="!formulaCheck(v).ok"
              @update:model-value="(text) => setField(i, 'formula', text, true)"
            />
            <p
              class="formula-note"
              :class="formulaCheck(v).ok ? 'formula-ok' : 'field-error'"
              role="status"
            >
              {{ formulaCheck(v).text }}
            </p>
          </div>
          <div class="variable-wide">
            <text-field
              label="Shown before the value (optional)"
              :model-value="v.prefix || ''"
              :placeholder="v.role === 'input' ? 'e.g. 1 : ' : ''"
              :hint="prefixHint(v)"
              :invalid="invalid(`variables/${i}/prefix`)"
              @update:model-value="(text) => setField(i, 'prefix', text)"
            />
          </div>
        </div>
      </li>
    </ol>

    <button
      type="button"
      class="btn btn-sm btn-outline-purple me-2"
      @click="add('input')"
    >
      + Add input
    </button>
    <button
      type="button"
      class="btn btn-sm btn-outline-purple"
      @click="add('output')"
    >
      + Add output
    </button>
    <button
      type="button"
      class="btn btn-sm btn-outline-purple ms-2"
      @click="add('calculated')"
    >
      + Add calculated
    </button>
  </div>
</template>

<script>
import KeyField from "./fields/KeyField.vue";
import RowTools from "./fields/RowTools.vue";
import TextField from "./fields/TextField.vue";
import { calculate, checkFormula } from "../../formula";
import {
  newVariableKey,
  removeVariable,
  renameVariable,
  setVariableRole,
  variableUses,
} from "../draft";

/**
 * The lesson's variables. Renaming or deleting one also updates the
 * simulation mapping and Simulation blocks, after asking.
 * Emits edit(fn(draft), boundary).
 */
export default {
  name: "VariablesForm",
  components: { KeyField, RowTools, TextField },
  props: {
    draft: { type: Object, required: true },
    invalid: { type: Function, default: () => false }, // by path from the lesson
  },
  emits: ["edit"],
  data() {
    return {
      keyFields: [],
      numberFields: [
        { field: "min", label: "Min" },
        { field: "max", label: "Max" },
        { field: "step", label: "Step" },
        { field: "default", label: "Starts at" },
      ],
    };
  },
  computed: {
    variables() {
      return Array.isArray(this.draft.variables)
        ? this.draft.variables.filter((v) => v && typeof v === "object")
        : [];
    },
    sliders() {
      return this.variables.filter((v) => v.role === "input" && v.key);
    },
  },
  methods: {
    edit(fn, boundary = false) {
      this.$emit("edit", fn, boundary);
    },
    usesOf(key) {
      return key ? variableUses(this.draft, key) : [];
    },
    otherKeys(key) {
      return new Set(this.variables.map((v) => v.key).filter((k) => k !== key));
    },
    rename(i, from, to) {
      if (!to) {
        this.keyFields[i].reset(); // a variable always needs a name
        return;
      }
      const uses = this.usesOf(from);
      const everywhere =
        !uses.length ||
        window.confirm(
          `“${from}” is used in ${uses.join(", ")}. Change ${
            uses.length === 1 ? "it" : "them"
          } to “${to}” too?`
        );
      this.edit((draft) => {
        if (everywhere) renameVariable(draft, from, to);
        else draft.variables[i].key = to;
      }, true);
    },
    setField(i, field, value, required = false) {
      this.edit((draft) => {
        if (value === "" && !required) delete draft.variables[i][field];
        else draft.variables[i][field] = value;
      });
    },
    setNumber(i, field, text) {
      const n = parseFloat(text);
      this.edit((draft) => {
        if (Number.isFinite(n)) draft.variables[i][field] = n;
        else delete draft.variables[i][field];
      }, true);
    },
    setRole(key, role) {
      this.edit((draft) => setVariableRole(draft, key, role), true);
    },
    move(i, dir) {
      this.edit((draft) => {
        const [v] = draft.variables.splice(i, 1);
        draft.variables.splice(i + dir, 0, v);
      }, true);
    },
    remove(v) {
      const uses = this.usesOf(v.key);
      const where = uses.length
        ? `\n\nIt's used in ${uses.join(
            ", "
          )}; it will be taken out of those too.`
        : "";
      if (!window.confirm(`Delete the variable “${v.label || v.key}”?${where}`))
        return;
      this.edit((draft) => removeVariable(draft, v.key), true);
    },
    add(role) {
      this.edit((draft) => {
        if (!Array.isArray(draft.variables)) draft.variables = [];
        const label = {
          input: "New input",
          output: "New output",
          calculated: "New calculated value",
        }[role];
        const variable = { key: newVariableKey(draft, label), label, role };
        if (role === "input")
          Object.assign(variable, { min: 0, max: 10, step: 1, default: 5 });
        if (role === "calculated") {
          const first = this.sliders[0];
          variable.formula = first ? first.key : "";
        }
        draft.variables.push(variable);
      }, true);
    },
    /**
     * What the formula field says: what the formula uses and its value with
     * the sliders at their starting values, or what to fix.
     */
    formulaCheck(v) {
      const check = checkFormula(v.formula, this.sliders);
      if (!check.ok) return { ok: false, text: check.message };
      const start = Object.fromEntries(
        this.sliders.map((s) => [
          s.key,
          s.default !== undefined ? s.default : s.min,
        ])
      );
      const value = calculate(v.formula, start);
      const used = check.names
        .map((key) => {
          const s = this.sliders.find((slider) => slider.key === key);
          return (s && s.label) || key;
        })
        .join(", ");
      const shown =
        value === null
          ? "can't be worked out (e.g. it divides by zero)"
          : `${(v.prefix || "") + Number(value.toFixed(6))}${
              v.unit ? ` ${v.unit}` : ""
            }`;
      return {
        ok: true,
        text: `✓ ${
          used ? `Uses ${used}. ` : "A fixed value. "
        }With the sliders at their starting values: ${shown}.`,
      };
    },
    prefixHint(v) {
      const example = v.role === "input" ? "3" : "2.5";
      return v.prefix
        ? `Shown as “${v.label || v.key}: ${v.prefix}${example}”.`
        : "E.g. “1 : ” to show a ratio as 1 : 3. Leave empty for a plain number.";
    },
  },
};
</script>

<style>
.lesson-form .variable-card {
  margin-bottom: 12px;
  padding: 10px 12px 0;
  border: 1px solid var(--inq-line, #ddd8ea);
  border-radius: 6px;
}
.lesson-form .variable-card.is-invalid {
  border-color: #b42318;
}
.lesson-form .variable-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.lesson-form .variable-head strong {
  flex: 1 1 auto;
  min-width: 0;
}
.lesson-form .role-badge {
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}
.lesson-form .role-input {
  background: #e9e5f2;
  color: #463a73;
}
.lesson-form .role-output {
  background: #e7f4ec;
  color: #1e6b3a;
}
.lesson-form .role-calculated {
  background: #fde9d4;
  color: #8a4a0b;
}
.lesson-form .variable-wide {
  grid-column: 1 / -1;
}
.lesson-form p.formula-note {
  margin: -6px 0 10px;
  font-size: 13px;
}
.lesson-form .formula-ok {
  color: #1e6b3a;
}
.lesson-form .variable-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  column-gap: 12px;
}
.lesson-form .variable-grid .key-input {
  max-width: none;
}
</style>
