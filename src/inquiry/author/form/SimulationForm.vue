<template>
  <div class="simulation-form">
    <div v-if="!sim" class="form-later">
      <p class="mb-2">
        This lesson has no physics project. Add one to run it in Simulation
        blocks.
      </p>
      <button
        type="button"
        class="btn btn-sm btn-purple"
        @click="addSimulation"
      >
        Add a physics project
      </button>
    </div>

    <template v-else>
      <!-- Project -->
      <div class="sim-row">
        <text-field
          label="Project owner"
          :model-value="sim.owner || ''"
          :invalid="invalid('simulation/owner')"
          @update:model-value="(v) => setSim('owner', v)"
        />
        <text-field
          label="Project name"
          :model-value="sim.project || ''"
          :invalid="invalid('simulation/project')"
          @update:model-value="(v) => setSim('project', v)"
        />
      </div>
      <div class="field">
        <button
          type="button"
          class="btn btn-sm btn-purple"
          :disabled="loading || !sim.owner || !sim.project"
          @click="load"
        >
          {{ loading ? "Loading the project…" : "Load variables from project" }}
        </button>
        <button
          v-if="loading"
          type="button"
          class="btn btn-sm btn-link"
          @click="cancel"
        >
          Stop
        </button>
        <p
          v-if="loadNote"
          class="field-hint"
          :class="{ 'field-error': loadFailed }"
          role="status"
        >
          {{ loadNote }}
        </p>
      </div>
      <details class="field">
        <summary class="summary-label">More project settings</summary>
        <div class="sim-row mt-2">
          <text-field
            label="Saved runs name (key)"
            :model-value="sim.key || ''"
            :invalid="invalid('simulation/key')"
            hint="Students' runs are saved under this name; lessons with the same name share runs. Changing it after publishing starts saved runs afresh."
            @update:model-value="(v) => setSim('key', v, true)"
          />
          <text-field
            label="Site"
            :model-value="sim.source || ''"
            :invalid="invalid('simulation/source')"
            @update:model-value="(v) => setSim('source', v, true)"
          />
        </div>
      </details>

      <!-- Mapping -->
      <fieldset class="field">
        <legend class="field-label">
          Link lesson variables to the project
        </legend>
        <p v-if="!variables.length" class="field-hint">
          The lesson has no variables yet.
          <template v-if="globals"
            >Add some from the project below, or</template
          >
          <button
            type="button"
            class="btn btn-sm btn-link p-0 align-baseline"
            @click="$emit('select', { kind: 'variables' })"
          >
            add them under Variables.
          </button>
        </p>
        <div v-for="v in variables" :key="v.key" class="map-row">
          <label class="map-name" :for="`map-${v.key}`">
            {{ v.label || v.key }}
            <span class="role-badge" :class="`role-${v.role}`">{{
              v.role
            }}</span>
          </label>
          <span class="map-arrow" aria-hidden="true">→</span>
          <project-variable-picker
            :id="`map-${v.key}`"
            :value="mappingOf(v)"
            :globals="globals"
            :lists="false"
            empty-label="— not linked —"
            :invalid="invalid(`simulation/${fieldOf(v)}/${v.key}`)"
            @pick="(name, typed) => setMapping(v, name, typed)"
          />
        </div>
      </fieldset>

      <div v-if="unused.length" class="field">
        <div class="field-label">
          <span>Project variables nothing uses</span>
        </div>
        <ul class="list-unstyled">
          <li v-for="g in unused" :key="g.name" class="unused-row">
            <span class="unused-name">
              {{ g.name }} <span class="text-muted">{{ g.text }}</span>
            </span>
            <button
              type="button"
              class="btn btn-sm btn-outline-purple"
              @click="addFromProject(g, 'input')"
            >
              Add as input
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-purple"
              @click="addFromProject(g, 'output')"
            >
              Add as output
            </button>
          </li>
        </ul>
      </div>

      <!-- Recorded over time -->
      <fieldset class="field">
        <legend class="field-label">Recorded over time</legend>
        <div class="form-check">
          <input
            id="sim-series"
            class="form-check-input"
            type="checkbox"
            :checked="!!sim.timeSeries"
            @change="setSeries($event.target.checked)"
          />
          <label class="form-check-label" for="sim-series">
            The project keeps a list with one row per moment, for time graphs
          </label>
        </div>
        <div v-if="sim.timeSeries" class="series-box">
          <div class="map-row">
            <label class="map-name" for="sim-series-list">List variable</label>
            <project-variable-picker
              id="sim-series-list"
              :value="sim.timeSeries.variable || ''"
              :globals="globals"
              :lists="true"
              empty-label="— pick the list —"
              :invalid="invalid('simulation/timeSeries/variable')"
              @pick="(name) => editSim((s) => (s.timeSeries.variable = name))"
            />
          </div>
          <p class="field-hint">
            Each row's items, in order:
            <span v-if="sampleRow"
              >(the project's first row is {{ sampleRow }})</span
            >
          </p>
          <ol class="list-unstyled item-list">
            <li v-for="(column, c) in columns" :key="c" class="item-row">
              <span class="column-number">{{ c + 1 }}</span>
              <select
                class="form-select form-select-sm"
                :class="{
                  'is-invalid': invalid(`simulation/timeSeries/columns/${c}`),
                }"
                :aria-label="`Item ${c + 1} of each row`"
                :value="column"
                @change="setColumn(c, $event.target.value)"
              >
                <option v-if="!columnChoices.includes(column)" :value="column">
                  {{ column }} (not an output)
                </option>
                <option
                  v-for="choice in columnChoices"
                  :key="choice"
                  :value="choice"
                >
                  {{ choice === "time" ? "Time" : labelOf(choice) }}
                </option>
              </select>
              <row-tools
                :index="c"
                :count="columns.length"
                :can-remove="columns.length > 2"
                :what="`item ${c + 1}`"
                @move="(dir) => moveColumn(c, dir)"
                @remove="removeColumn(c)"
              />
            </li>
          </ol>
          <button
            type="button"
            class="btn btn-sm btn-link add-link"
            @click="addColumn"
          >
            + Add item
          </button>
        </div>
      </fieldset>

      <!-- Start and finish -->
      <fieldset class="field">
        <legend class="field-label">A run starts with</legend>
        <div class="form-check form-check-inline">
          <input
            id="run-flag"
            class="form-check-input"
            type="radio"
            name="run-mode"
            :checked="runMode === 'greenFlag'"
            @change="setRun('greenFlag')"
          />
          <label class="form-check-label" for="run-flag">The green flag</label>
        </div>
        <div class="form-check form-check-inline">
          <input
            id="run-message"
            class="form-check-input"
            type="radio"
            name="run-mode"
            :checked="runMode === 'message'"
            @change="setRun('message')"
          />
          <label class="form-check-label" for="run-message">A message</label>
        </div>
        <input
          v-if="runMode === 'message'"
          type="text"
          class="form-control mt-1"
          aria-label="Message that starts a run"
          :class="{ 'is-invalid': invalid('simulation/run') }"
          :value="sim.run.message || ''"
          @input="editSim((s) => (s.run.message = $event.target.value))"
        />
      </fieldset>

      <fieldset class="field">
        <legend class="field-label">A run has finished</legend>
        <div v-for="m in doneModes" :key="m.id" class="form-check">
          <input
            :id="`done-mode-${m.id}`"
            class="form-check-input"
            type="radio"
            name="done-mode"
            :checked="doneMode === m.id"
            @change="setDone(m.id)"
          />
          <label class="form-check-label" :for="`done-mode-${m.id}`">{{
            m.label
          }}</label>
        </div>
        <div class="done-box">
          <div v-if="doneMode !== 'message'" class="map-row">
            <label class="map-name" for="done-variable">
              {{
                doneMode === "poll"
                  ? "Variable that stops changing"
                  : "Variable"
              }}
            </label>
            <project-variable-picker
              id="done-variable"
              :value="sim.done.variable || (doneMode === 'poll' ? 'time' : '')"
              :globals="globals"
              :lists="false"
              empty-label="— pick a variable —"
              :invalid="invalid('simulation/done')"
              @pick="(name) => editSim((s) => (s.done.variable = name))"
            />
          </div>
          <div v-if="doneMode === 'variable'" class="map-row">
            <label class="map-name" for="done-value">equals</label>
            <input
              id="done-value"
              type="text"
              class="form-control form-control-sm"
              :value="
                sim.done.value === undefined ? '' : String(sim.done.value)
              "
              @change="setDoneValue($event.target.value)"
            />
          </div>
          <div v-if="doneMode === 'message'" class="map-row">
            <label class="map-name" for="done-message">Message</label>
            <input
              id="done-message"
              type="text"
              class="form-control form-control-sm"
              :class="{ 'is-invalid': invalid('simulation/done') }"
              :value="sim.done.message || ''"
              @input="editSim((s) => (s.done.message = $event.target.value))"
            />
          </div>
          <div class="map-row">
            <label class="map-name" for="done-timeout"
              >Give up after (seconds)</label
            >
            <input
              id="done-timeout"
              type="number"
              min="1"
              class="form-control form-control-sm timeout-input"
              :value="sim.done.timeoutMs ? sim.done.timeoutMs / 1000 : ''"
              placeholder="30"
              @change="setGiveUp($event.target.value)"
            />
          </div>
        </div>
      </fieldset>

      <button
        type="button"
        class="btn btn-sm btn-outline-danger"
        @click="removeSimulation"
      >
        Remove the physics project
      </button>
    </template>
  </div>
</template>

<script>
import ProjectVariablePicker from "./fields/ProjectVariablePicker.vue";
import RowTools from "./fields/RowTools.vue";
import TextField from "./fields/TextField.vue";
import {
  cachedGlobals,
  describeValue,
  loadProjectGlobals,
} from "./fields/ProjectVariables";
import { blocksOf, newSimulation, newVariableKey } from "../draft";

/**
 * The lesson's simulation: which project, how lesson variables link to its
 * global variables, what it records over time, and how a run starts and
 * ends. Load variables reads the project so all of this is picked from
 * lists. Emits edit(fn(draft), boundary) and select(selection).
 */
export default {
  name: "SimulationForm",
  components: { ProjectVariablePicker, RowTools, TextField },
  props: {
    draft: { type: Object, required: true },
    invalid: { type: Function, default: () => false }, // by path from the lesson
  },
  emits: ["edit", "select"],
  data() {
    return {
      globals: this.draft.simulation
        ? cachedGlobals(this.draft.simulation)
        : null, // { name: value } once loaded
      loading: false,
      loadNote: "",
      loadFailed: false,
      doneModes: [
        { id: "poll", label: "When a variable stops changing (usually time)" },
        { id: "variable", label: "When a variable reaches a value" },
        { id: "message", label: "When the project sends a message" },
      ],
    };
  },
  computed: {
    sim() {
      return this.draft.simulation || null;
    },
    variables() {
      const list = this.draft.variables;
      return Array.isArray(list) ? list.filter((v) => v && v.key) : [];
    },
    runMode() {
      return (this.sim.run && this.sim.run.mode) || "greenFlag";
    },
    doneMode() {
      return (this.sim.done && this.sim.done.mode) || "poll";
    },
    columns() {
      const series = this.sim.timeSeries;
      return series && Array.isArray(series.columns) ? series.columns : [];
    },
    columnChoices() {
      return [
        "time",
        ...this.variables.filter((v) => v.role === "output").map((v) => v.key),
      ];
    },
    sampleRow() {
      const list =
        this.globals &&
        this.sim.timeSeries &&
        this.globals[this.sim.timeSeries.variable];
      const row = Array.isArray(list) && list[0];
      return Array.isArray(row)
        ? `[${row.map((x) => describeValue(x)).join(", ")}]`
        : "";
    },
    /** Project variables nothing in the lesson's simulation refers to. */
    unused() {
      if (!this.globals) return [];
      const sim = this.sim;
      const used = new Set([
        ...Object.values(sim.inputs || {}),
        ...Object.values(sim.outputs || {}),
        sim.timeSeries && sim.timeSeries.variable,
        sim.done && (sim.done.variable || "time"),
      ]);
      return Object.entries(this.globals)
        .filter(([name, value]) => !used.has(name) && !Array.isArray(value))
        .map(([name, value]) => ({ name, value, text: describeValue(value) }));
    },
  },
  watch: {
    "sim.project"() {
      this.forget();
    },
    "sim.owner"() {
      this.forget();
    },
  },
  beforeUnmount() {
    this.cancel();
  },
  methods: {
    edit(fn, boundary = false) {
      this.$emit("edit", fn, boundary);
    },
    editSim(fn, boundary = false) {
      this.edit((draft) => fn(draft.simulation), boundary);
    },
    setSim(field, value, required = false) {
      this.editSim((s) => {
        if (value === "" && !required) delete s[field];
        else s[field] = value;
      });
    },
    forget() {
      // The loaded list belonged to another project
      if (this.loading) return;
      this.globals = this.sim ? cachedGlobals(this.sim) : null;
      this.loadNote = "";
    },
    async load() {
      this.cancel();
      this.loading = true;
      this.loadFailed = false;
      this.loadNote =
        "Opening the project out of sight. This can take up to 45 seconds.";
      try {
        this.loader = loadProjectGlobals(this.sim);
        const globals = await this.loader.done;
        this.globals = globals;
        const count = Object.keys(globals).length;
        this.loadNote = `Loaded ${count} global variable${
          count === 1 ? "" : "s"
        } from ${this.sim.project}.`;
      } catch (e) {
        if (e.message === "closed") {
          this.loadNote = "";
        } else {
          this.loadFailed = true;
          this.loadNote = `Couldn't read the project: ${e.message}. Check the owner and project name, and that the project is shared.`;
        }
      } finally {
        this.loading = false;
        this.loader = null;
      }
    },
    cancel() {
      if (this.loader) this.loader.cancel();
    },
    labelOf(key) {
      const v = this.variables.find((variable) => variable.key === key);
      return v ? v.label || key : key;
    },
    fieldOf(v) {
      return v.role === "input" ? "inputs" : "outputs";
    },
    mappingOf(v) {
      const mapping = this.sim[this.fieldOf(v)];
      return (mapping && mapping[v.key]) || "";
    },
    setMapping(v, name, typed = false) {
      const field = this.fieldOf(v);
      this.editSim((s) => {
        if (!s[field] || typeof s[field] !== "object") s[field] = {};
        if (name) s[field][v.key] = name;
        else delete s[field][v.key];
      }, !typed);
    },
    addFromProject(g, role) {
      this.edit((draft) => {
        if (!Array.isArray(draft.variables)) draft.variables = [];
        const key = newVariableKey(draft, g.name);
        const label = g.name.charAt(0).toUpperCase() + g.name.slice(1);
        const variable = { key, label, role };
        // Only the starting value; the slider's range is the author's call
        const number =
          typeof g.value === "number" ? g.value : parseFloat(g.value);
        if (role === "input" && Number.isFinite(number))
          variable.default = number;
        draft.variables.push(variable);
        const field = role === "input" ? "inputs" : "outputs";
        draft.simulation[field] = { ...draft.simulation[field], [key]: g.name };
      }, true);
    },
    setSeries(on) {
      const list = this.globals
        ? Object.keys(this.globals).find((name) =>
            Array.isArray(this.globals[name])
          )
        : null;
      this.editSim((s) => {
        if (on)
          s.timeSeries = {
            variable: list || "run log",
            columns: ["time", ...this.columnChoices.slice(1, 2)],
          };
        else delete s.timeSeries;
      }, true);
    },
    editColumns(fn) {
      this.editSim((s) => fn(s.timeSeries.columns), true);
    },
    setColumn(c, value) {
      this.editColumns((columns) => {
        columns[c] = value;
      });
    },
    moveColumn(c, dir) {
      this.editColumns((columns) => {
        const [column] = columns.splice(c, 1);
        columns.splice(c + dir, 0, column);
      });
    },
    removeColumn(c) {
      this.editColumns((columns) => columns.splice(c, 1));
    },
    addColumn() {
      const next =
        this.columnChoices.find((choice) => !this.columns.includes(choice)) ||
        "time";
      this.editColumns((columns) => columns.push(next));
    },
    setRun(mode) {
      this.editSim((s) => {
        s.run =
          mode === "message"
            ? { mode, message: (s.run && s.run.message) || "" }
            : { mode };
      }, true);
    },
    setDone(mode) {
      this.editSim((s) => {
        const old = s.done || {};
        const done = { mode };
        if (old.timeoutMs) done.timeoutMs = old.timeoutMs;
        if (mode === "poll") done.variable = old.variable || "time";
        if (mode === "variable") {
          done.variable = old.variable || "";
          done.value = old.value === undefined ? "" : old.value;
        }
        if (mode === "message") done.message = old.message || "";
        s.done = done;
      }, true);
    },
    setDoneValue(text) {
      // Numbers stay numbers, so 1 matches the project's 1
      const n = Number(text);
      const value = text.trim() !== "" && Number.isFinite(n) ? n : text;
      this.editSim((s) => {
        s.done.value = value;
      }, true);
    },
    setGiveUp(text) {
      const seconds = parseFloat(text);
      this.editSim((s) => {
        if (Number.isFinite(seconds) && seconds > 0) {
          s.done.timeoutMs = Math.max(1000, Math.round(seconds * 1000));
        } else delete s.done.timeoutMs;
      }, true);
    },
    addSimulation() {
      this.edit((draft) => {
        draft.simulation = newSimulation(draft);
      }, true);
    },
    removeSimulation() {
      const blocks = blocksOf(this.draft).filter(
        ({ block }) => block.type === "simulation"
      ).length;
      const note = blocks
        ? `\n\n${blocks} Simulation block${
            blocks === 1 ? "" : "s"
          } will have nothing to run until you add one again.`
        : "";
      if (!window.confirm(`Remove the physics project?${note}`)) return;
      this.edit((draft) => delete draft.simulation, true);
    },
  },
};
</script>

<style>
.lesson-form .sim-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  column-gap: 12px;
}
.lesson-form .map-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin-bottom: 6px;
}
.lesson-form .map-name {
  flex: 0 1 220px;
  min-width: 0;
  font-size: 14px;
}
.lesson-form .map-arrow {
  color: var(--inq-muted, #5c5670);
}
.lesson-form .map-row > select,
.lesson-form .map-row > input {
  flex: 1 1 180px;
  min-width: 0;
  width: auto;
}
.lesson-form .map-row > .timeout-input {
  flex: 0 0 100px;
}
.lesson-form .unused-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.lesson-form .unused-name {
  flex: 1 1 160px;
  font-size: 14px;
}
.lesson-form .series-box,
.lesson-form .done-box {
  margin-top: 8px;
  padding: 8px 10px 2px;
  border-radius: 4px;
  background: var(--inq-tint, #f4f2f9);
}
.lesson-form .column-number {
  flex: 0 0 20px;
  text-align: right;
  color: var(--inq-muted, #5c5670);
}
</style>
