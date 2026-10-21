<template>
  <div class="sim">
    <p v-if="block.prompt" class="mb-2">{{ prompt }}</p>

    <div class="sim-grid">
      <div class="sim-controls sim-panel">
        <div v-for="v in inputs" :key="v.key" class="mb-2">
          <label :for="`${block.id}-${v.key}`" class="form-label mb-0">
            {{ v.label }}: <strong>{{ values[v.key] }}</strong> {{ v.unit }}
          </label>
          <input
            :id="`${block.id}-${v.key}`"
            v-model.number="values[v.key]"
            type="range"
            class="form-range"
            :min="v.min"
            :max="v.max"
            :step="v.step || 'any'"
            :disabled="readOnly || running"
          />
        </div>
        <button
          type="button"
          class="btn sim-run w-100"
          :disabled="!canRun"
          @click="run"
        >
          {{ running ? "Running…" : "Run Simulation" }}
        </button>
      </div>

      <div class="sim-stage">
        <div v-if="configured && status === 'loading'" class="sim-cover">
          Loading the simulation…
        </div>
        <iframe
          v-if="configured"
          :key="frameKey"
          ref="frame"
          :src="url"
          title="Simulation"
        ></iframe>
        <p v-else class="sim-placeholder">
          The simulation isn't set up for this lesson yet.
        </p>
      </div>

      <div class="sim-side">
        <button
          type="button"
          class="btn sim-results w-100"
          :disabled="!runs.length"
          @click="open('results')"
        >
          Results
        </button>
        <div class="sim-panel sim-readouts">
          <button
            v-if="graphVariables.length"
            type="button"
            class="btn btn-link p-0 mb-1"
            :disabled="!hasSeries"
            @click="open('graph')"
          >
            Graph
          </button>
          <div v-for="o in outputs" :key="o.key">
            {{ o.label }}:
            <strong>{{ format(latest && latest.outputs[o.key]) }}</strong>
            {{ latest && o.unit ? o.unit : "" }}
          </div>
        </div>
      </div>
    </div>

    <p class="sim-status mb-0 mt-2" role="status">
      <span v-if="error" class="text-danger">
        {{ error }}.
        <button type="button" class="btn btn-link p-0" @click="reload">
          Try again
        </button>
      </span>
      <span v-else-if="missing.length" class="text-warning-emphasis">
        This project has no variable named {{ missing.join(", ") }}.
      </span>
      <span v-if="!readOnly && runs.length < minRuns">
        Run the simulation at least {{ minRuns }} times to continue ({{
          runs.length
        }}
        done).
      </span>
    </p>

    <dialog
      ref="dialog"
      class="sim-dialog"
      :aria-label="dialog === 'graph' ? 'Graph' : 'Results'"
      @click="closeOnBackdrop"
      @close="dialog = null"
    >
      <div class="sim-dialog-body">
        <div class="d-flex align-items-center mb-2">
          <h3 class="h5 mb-0 me-auto">
            {{ dialog === "graph" ? "Graph" : "Results" }}
          </h3>
          <button
            type="button"
            class="btn-close"
            aria-label="Close"
            @click="$refs.dialog.close()"
          ></button>
        </div>

        <div v-if="dialog === 'results'" class="table-responsive">
          <table class="table table-sm sim-table mb-0">
            <thead>
              <tr>
                <th scope="col">Trial</th>
                <th v-for="v in inputs" :key="v.key" scope="col">
                  {{ heading(v) }}
                </th>
                <th v-for="o in outputs" :key="o.key" scope="col">
                  {{ heading(o) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in runs" :key="i">
                <th scope="row">{{ i + 1 }}</th>
                <td v-for="v in inputs" :key="v.key">
                  {{ format(r.inputs[v.key]) }}
                </td>
                <td v-for="o in outputs" :key="o.key">
                  {{ format(r.outputs[o.key]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <run-graph
          v-if="dialog === 'graph'"
          :runs="graphRuns"
          :variables="graphVariables"
          :chosen="graphChosen"
          :choose="!!block.graph.choose"
          :max-y="graphMaxY"
          @update:chosen="chooseGraph"
        />
      </div>
    </dialog>
  </div>
</template>

<script>
import { fillRefs, minRunsOf, runsOf } from "../lesson";
import { NetsBloxSim, projectUrl } from "../sim/netsblox";
import RunGraph from "../sim/RunGraph.vue";
import blockProps from "./blockProps";

/**
 * Sliders, the embedded physics project, readouts of the latest run, and
 * Results / Graph pop-ups. Each run is saved, so the answer is
 * { runs: [{ inputs, outputs, series, at }] }; Next waits for minRuns.
 * The graph shows graph.y at first; with graph.choose students pick from
 * every recorded output, up to graph.maxY at once.
 */
export default {
  name: "SimulationBlock",
  components: { RunGraph },
  props: blockProps,
  emits: ["answer"],
  data() {
    return {
      values: {},
      status: "loading", // loading | ready | running
      error: null,
      missing: [],
      dialog: null,
      frameKey: 0,
      picked: null, // the student's graph variables, once they change them
    };
  },
  computed: {
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
    sim() {
      return this.ctx.lesson.simulation;
    },
    configured() {
      const sim = this.sim;
      return (
        !!sim && ![sim.owner, sim.project].some((v) => /REPLACE_ME/.test(v))
      );
    },
    url() {
      return projectUrl(this.sim);
    },
    inputs() {
      return this.block.inputs.map(this.variable);
    },
    outputs() {
      return this.block.outputs.map(this.variable);
    },
    /** Variables the graph may show: graph.y, or every recorded output if students choose. */
    graphVariables() {
      const graph = this.block.graph;
      const series = this.sim && this.sim.timeSeries;
      if (!graph || !series) return [];
      const recorded = (series.columns || []).filter((c) => c !== "time");
      const outputs = (this.ctx.lesson.variables || [])
        .filter((v) => v.role === "output")
        .map((v) => v.key);
      const keys = graph.choose
        ? recorded.filter((c) => outputs.includes(c))
        : (graph.y || []).filter((k) => recorded.includes(k));
      return keys.map(this.variable);
    },
    graphMaxY() {
      return (this.block.graph && this.block.graph.maxY) || 4;
    },
    graphChosen() {
      const offered = this.graphVariables.map((v) => v.key);
      const start = this.picked || (this.block.graph && this.block.graph.y);
      return (start || []).filter((k) => offered.includes(k));
    },
    runs() {
      return runsOf(this.value);
    },
    latest() {
      return this.runs[this.runs.length - 1];
    },
    minRuns() {
      return minRunsOf(this.block);
    },
    running() {
      return this.status === "running";
    },
    canRun() {
      return !this.readOnly && this.configured && this.status === "ready";
    },
    hasSeries() {
      return this.runs.some((r) => r.series && r.series.length);
    },
    graphRuns() {
      return this.runs.map((r, i) => ({
        label: `Trial ${i + 1}`,
        series: r.series,
      }));
    },
  },
  created() {
    const last = this.latest ? this.latest.inputs : {};
    for (const v of this.inputs) {
      const start = last[v.key] !== undefined ? last[v.key] : v.default;
      this.values[v.key] = start !== undefined ? start : v.min;
    }
  },
  mounted() {
    if (this.configured) this.connect();
  },
  beforeUnmount() {
    if (this.adapter) this.adapter.destroy();
  },
  methods: {
    variable(key) {
      const found = (this.ctx.lesson.variables || []).find(
        (v) => v.key === key
      );
      return found || { key, label: key };
    },
    async connect() {
      this.status = "loading";
      this.error = null;
      this.adapter = new NetsBloxSim(this.$refs.frame, this.sim);
      const adapter = this.adapter;
      try {
        this.missing = await adapter.ready();
        if (this.adapter === adapter) this.status = "ready";
      } catch (e) {
        if (this.adapter === adapter) this.fail(e, "load");
      }
    },
    reload() {
      if (this.adapter) this.adapter.destroy();
      this.frameKey += 1;
      this.$nextTick(this.connect);
    },
    fail(e, during) {
      if (e.message === "closed") return;
      this.log("sim_error", { message: e.message, during });
      this.error = e.message;
      this.status = null;
    },
    async run() {
      const adapter = this.adapter;
      const inputs = { ...this.values };
      this.status = "running";
      this.error = null;
      try {
        const { outputs, series } = await adapter.run(inputs);
        const run = { inputs, outputs, series, at: new Date().toISOString() };
        // Build on the live answer, as two runs may be saved before a render
        const saved = runsOf(this.ctx.answers[this.block.id]);
        this.$emit("answer", { runs: [...saved, run] });
        this.log("sim_run", { inputs, outputs });
        this.status = "ready";
      } catch (e) {
        if (this.adapter === adapter) this.fail(e, "run");
      }
    },
    log(type, data) {
      this.$store.dispatch("inquiry/log", {
        type,
        blockId: this.block.id,
        data,
      });
    },
    open(which) {
      this.log("dialog_open", { dialog: which });
      this.dialog = which;
      this.$refs.dialog.showModal();
    },
    chooseGraph(keys) {
      this.picked = keys;
      this.log("graph_change", { variables: keys });
    },
    closeOnBackdrop(event) {
      if (event.target === this.$refs.dialog) this.$refs.dialog.close();
    },
    heading(v) {
      return v.unit ? `${v.label} (${v.unit})` : v.label;
    },
    format(n) {
      if (n === undefined || n === null || n === "") return "—";
      return typeof n === "number"
        ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : String(n);
    },
  },
};
</script>

<style scoped>
.sim {
  container-type: inline-size;
}
.sim-grid {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 190px;
  grid-template-areas: "controls stage side";
  gap: 12px;
  align-items: start;
  border: 2px solid var(--inq-soft-border, #cfc9df);
  border-radius: 8px;
  padding: 12px;
}
.sim-controls {
  grid-area: controls;
}
.sim-stage {
  grid-area: stage;
  position: relative;
}
/* Hides the NetsBlox editor that shows while the project opens */
.sim-cover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--inq-tint, #f4f2f9);
  color: var(--inq-muted, #5c5670);
}
.sim-side {
  grid-area: side;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
@container (max-width: 720px) {
  .sim-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: "stage stage" "controls side";
  }
}
@container (max-width: 480px) {
  .sim-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "stage" "controls" "side";
  }
}
.sim-panel {
  border: 2px solid var(--inq-ink, #2e2645);
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}
.sim-stage iframe,
.sim-placeholder {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  border: 1px solid var(--inq-line, #ddd8ea);
  border-radius: 6px;
}
.sim-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 16px;
  text-align: center;
  background: var(--inq-tint, #f4f2f9);
  color: var(--inq-muted, #5c5670);
}
.sim-run {
  background: var(--inq-purple, #615195);
  border-color: var(--inq-purple, #615195);
  color: #fff;
}
.sim-run:hover:not(:disabled) {
  background: var(--inq-purple-dark, #463a73);
  color: #fff;
}
.sim-results {
  border: 2px solid var(--inq-purple, #615195);
  color: var(--inq-purple, #615195);
  font-weight: 600;
}
.sim-results:hover:not(:disabled) {
  background: var(--inq-tint, #f4f2f9);
}
.sim-readouts {
  line-height: 1.9;
}
.sim-status {
  color: var(--inq-muted, #5c5670);
  font-size: 14px;
}
.sim-status > span + span {
  margin-left: 6px;
}
.sim-dialog {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 0;
  border: none;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(46, 38, 69, 0.3);
}
.sim-dialog::backdrop {
  background: rgba(46, 38, 69, 0.45);
}
.sim-dialog-body {
  padding: 18px 20px;
}
.sim-table {
  text-align: center;
  font-size: 14px;
}
.sim-table thead th {
  background: var(--inq-ink, #2e2645);
  color: #fff;
}
</style>
