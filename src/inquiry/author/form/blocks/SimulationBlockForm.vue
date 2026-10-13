<template>
  <div>
    <div v-if="!sim" class="form-later">
      <p class="mb-2">
        This lesson has no simulation yet. Set one up first; this block then
        runs it.
      </p>
      <button
        type="button"
        class="btn btn-sm btn-outline-purple"
        @click="$emit('select', { kind: 'simulation' })"
      >
        Set up the simulation
      </button>
    </div>

    <text-field
      label="Question"
      multiline
      :rows="2"
      :model-value="block.prompt || ''"
      :refs="answers"
      :invalid="invalid('prompt')"
      @update:model-value="(v) => set('prompt', v)"
    />

    <fieldset
      v-for="group in groups"
      :key="group.field"
      class="field"
      :class="{ 'is-invalid': invalid(group.field) }"
    >
      <legend class="field-label">{{ group.label }}</legend>
      <p v-if="!group.variables.length" class="field-hint">
        The lesson has no {{ group.role }} variables.
        <button
          type="button"
          class="btn btn-sm btn-link p-0 align-baseline"
          @click="$emit('select', { kind: 'variables' })"
        >
          Add some under Variables.
        </button>
      </p>
      <div v-for="v in group.variables" :key="v.key" class="form-check">
        <input
          :id="`${group.field}-${block.id}-${v.key}`"
          class="form-check-input"
          type="checkbox"
          :checked="listOf(group.field).includes(v.key)"
          @change="toggle(group.field, v.key, $event.target.checked)"
        />
        <label
          class="form-check-label"
          :for="`${group.field}-${block.id}-${v.key}`"
        >
          {{ v.label || v.key }}<span v-if="v.unit"> ({{ v.unit }})</span>
          <span v-if="sim && !mapped(group.mapping, v.key)" class="text-danger">
            · not linked to the project yet
          </span>
        </label>
      </div>
    </fieldset>

    <fieldset class="field">
      <legend class="field-label">Time graph</legend>
      <p v-if="!series" class="field-hint">
        A time graph needs the simulation to record values over time; set that
        up under Simulation.
      </p>
      <template v-else>
        <div class="form-check">
          <input
            :id="`graph-${block.id}`"
            class="form-check-input"
            type="checkbox"
            :checked="!!block.graph"
            @change="setGraph($event.target.checked)"
          />
          <label class="form-check-label" :for="`graph-${block.id}`">
            Students can open a graph of each run over time
          </label>
        </div>
        <div v-if="block.graph" class="ms-4 mt-1">
          <div v-for="key in plottable" :key="key" class="form-check">
            <input
              :id="`y-${block.id}-${key}`"
              class="form-check-input"
              type="checkbox"
              :checked="(block.graph.y || []).includes(key)"
              @change="toggleY(key, $event.target.checked)"
            />
            <label class="form-check-label" :for="`y-${block.id}-${key}`">
              {{ labelOf(key) }}
            </label>
          </div>
          <p v-if="!plottable.length" class="field-error">
            None of the recorded columns is an output variable.
          </p>
        </div>
      </template>
    </fieldset>

    <div class="field field-narrow">
      <div class="field-label">
        <label :for="`runs-${block.id}`">Runs needed before Next</label>
      </div>
      <input
        :id="`runs-${block.id}`"
        type="number"
        min="1"
        class="form-control"
        :class="{ 'is-invalid': invalid('minRuns') }"
        :value="block.minRuns"
        placeholder="1"
        @input="setMinRuns($event.target.value)"
      />
    </div>
  </div>
</template>

<script>
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";

/**
 * Simulation block: which input variables are sliders, which outputs are
 * shown, the time graph, and how many runs students need.
 */
export default {
  name: "SimulationBlockForm",
  components: { TextField },
  mixins: [blockForm],
  emits: ["select"],
  computed: {
    sim() {
      return (this.lesson && this.lesson.simulation) || null;
    },
    series() {
      return (this.sim && this.sim.timeSeries) || null;
    },
    variables() {
      const list = this.lesson && this.lesson.variables;
      return Array.isArray(list) ? list.filter((v) => v && v.key) : [];
    },
    groups() {
      return [
        { field: "inputs", role: "input", mapping: "inputs", label: "Sliders" },
        {
          field: "outputs",
          role: "output",
          mapping: "outputs",
          label: "Results shown",
        },
      ].map((group) => ({
        ...group,
        variables: this.variables.filter((v) => v.role === group.role),
      }));
    },
    plottable() {
      if (!this.series) return [];
      const outputs = this.variables
        .filter((v) => v.role === "output")
        .map((v) => v.key);
      return (this.series.columns || []).filter((c) => outputs.includes(c));
    },
  },
  methods: {
    listOf(field) {
      return Array.isArray(this.block[field]) ? this.block[field] : [];
    },
    mapped(field, key) {
      const mapping = this.sim && this.sim[field];
      return !!mapping && typeof mapping === "object" && key in mapping;
    },
    labelOf(key) {
      const v = this.variables.find((variable) => variable.key === key);
      return v ? v.label || key : key;
    },
    /** Ticks keep the lesson's variable order. */
    toggle(field, key, on) {
      const chosen = new Set(this.listOf(field));
      if (on) chosen.add(key);
      else chosen.delete(key);
      const order = this.variables.map((v) => v.key);
      const list = [
        ...order.filter((k) => chosen.has(k)),
        ...[...chosen].filter((k) => !order.includes(k)),
      ];
      this.edit((block) => {
        block[field] = list;
      }, true);
    },
    setGraph(on) {
      const y = this.plottable.filter((k) =>
        this.listOf("outputs").includes(k)
      );
      this.edit((block) => {
        if (on)
          block.graph = {
            x: "time",
            y: y.length ? y : this.plottable.slice(0, 1),
          };
        else delete block.graph;
      }, true);
    },
    toggleY(key, on) {
      const chosen = new Set(this.block.graph.y || []);
      if (on) chosen.add(key);
      else chosen.delete(key);
      const y = this.plottable.filter((k) => chosen.has(k));
      this.edit((block) => {
        block.graph.y = y;
      }, true);
    },
    setMinRuns(text) {
      const n = parseInt(text, 10);
      this.set("minRuns", Number.isFinite(n) ? n : null);
    },
  },
};
</script>
