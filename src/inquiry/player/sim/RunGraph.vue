<template>
  <div class="run-graph">
    <!-- Which variables to show, when the lesson lets students choose -->
    <fieldset v-if="choose && variables.length > 1" class="picker">
      <legend class="visually-hidden">Variables to show</legend>
      <label
        v-for="v in variables"
        :key="v.key"
        class="chip"
        :class="{ on: isChosen(v.key), off: isFull && !isChosen(v.key) }"
      >
        <input
          type="checkbox"
          :checked="isChosen(v.key)"
          :disabled="isFull && !isChosen(v.key)"
          @change="toggle(v.key, $event.target.checked)"
        />
        <i :style="{ background: colorOf(v.key) }"></i>
        {{ heading(v) }}
      </label>
    </fieldset>
    <p v-if="choose && variables.length > 1" class="hint">
      Tick up to {{ maxY }}. Variables with the same unit share a graph.
    </p>

    <div v-if="runs.length > 1" class="trials">
      <label :for="`${uid}-trials`">Trials</label>
      <select
        :id="`${uid}-trials`"
        v-model="trial"
        class="form-select form-select-sm"
      >
        <option value="all">All trials</option>
        <option v-for="(run, i) in runs" :key="i" :value="String(i)">
          {{ run.label }}
        </option>
      </select>
    </div>

    <p v-if="!groups.length" class="hint mt-2">Tick a variable to graph it.</p>

    <div ref="plots" class="plots">
      <figure v-for="group in groups" :key="group.unit" class="plot">
        <figcaption class="plot-title">
          {{ group.title }}
          <!-- Which colour is which, when a graph holds several variables -->
          <template v-if="group.vars.length > 1">
            <span v-for="v in group.vars" :key="v.key" class="key">
              <i :style="{ background: colorOf(v.key) }"></i>{{ v.label }}
            </span>
          </template>
        </figcaption>
        <svg
          :viewBox="`0 0 ${W} ${group.height}`"
          role="img"
          :aria-label="`${group.title}, ${shown.length} trial${
            shown.length === 1 ? '' : 's'
          }`"
          @mousemove="point($event, group)"
          @mouseleave="tip = null"
        >
          <g class="grid">
            <line
              v-for="t in group.ticks"
              :key="'g' + t"
              :x1="M.left"
              :x2="W - M.right"
              :y1="group.y(t)"
              :y2="group.y(t)"
            />
          </g>
          <!-- Where values change sign -->
          <line
            v-if="group.crossesZero"
            class="zero"
            :x1="M.left"
            :x2="W - M.right"
            :y1="group.y(0)"
            :y2="group.y(0)"
          />
          <g class="axis">
            <line
              :x1="M.left"
              :x2="M.left"
              :y1="M.top"
              :y2="M.top + group.plotHeight"
            />
            <line
              :x1="M.left"
              :x2="W - M.right"
              :y1="M.top + group.plotHeight"
              :y2="M.top + group.plotHeight"
            />
            <text
              v-for="t in xTicks"
              :key="'x' + t"
              :x="x(t)"
              :y="M.top + group.plotHeight + 18"
              text-anchor="middle"
            >
              {{ t }}
            </text>
            <text
              v-for="t in group.ticks"
              :key="'y' + t"
              :x="M.left - 8"
              :y="group.y(t) + 4"
              text-anchor="end"
            >
              {{ t }}
            </text>
            <text
              :x="(M.left + W - M.right) / 2"
              :y="group.height - 6"
              text-anchor="middle"
            >
              Time (s)
            </text>
            <text
              :transform="`translate(14 ${
                M.top + group.plotHeight / 2
              }) rotate(-90)`"
              text-anchor="middle"
            >
              {{ group.axis }}
            </text>
          </g>
          <polyline
            v-for="line in group.lines"
            :key="line.id"
            :points="line.points"
            :stroke="line.color"
            :stroke-dasharray="line.dash"
            :stroke-width="line.latest ? 3 : 2"
            fill="none"
          />
        </svg>
      </figure>
      <div
        v-if="tip"
        class="tip"
        :style="{ left: `${tip.left}px`, top: `${tip.top}px` }"
      >
        {{ tip.text }}
      </div>
    </div>

    <p v-if="runs.length > 1 && groups.length" class="legend">
      <span v-for="i in shown" :key="i">
        <svg width="28" height="6" aria-hidden="true">
          <line x1="0" x2="28" y1="3" y2="3" :stroke-dasharray="dashOf(i)" />
        </svg>
        {{ runs[i].label }}
      </span>
    </p>
  </div>
</template>

<script>
const COLORS = [
  "#d9822b",
  "#c0392b",
  "#2a9d8f",
  "#3a6ea5",
  "#615195",
  "#8a6d3b",
];
// Trials are told apart by line style; the newest run is also thicker
const DASHES = ["", "8 5", "2 4", "12 4 2 4", "1 6"];
// What a graph of several same-unit variables is called on its axis
const QUANTITIES = {
  J: "Energy",
  m: "Distance",
  "m/s": "Speed",
  "m/s²": "Acceleration",
  s: "Time",
  N: "Force",
  kg: "Mass",
};

/** Rounded tick values from min up to the first one at or past max. */
function ticks(min, max, count = 5) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (
    let t = Math.floor(min / step) * step;
    t < max + step - 1e-9;
    t += step
  ) {
    out.push(Math.round(t * 1e6) / 1e6);
  }
  return out;
}

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

let count = 0;

/**
 * Runs over time, one graph per unit: variables that share a unit share a
 * graph, and each other unit gets its own graph below on the same time
 * scale. Colour is the variable, line style the trial. Axes cover negative
 * values too, with a darker zero line.
 */
export default {
  name: "RunGraph",
  props: {
    runs: { type: Array, required: true }, // [{ label, series: [{ time, ... }] }]
    variables: { type: Array, required: true }, // offered: [{ key, label, unit }]
    chosen: { type: Array, required: true }, // keys shown, in the order ticked
    choose: { type: Boolean, default: false },
    maxY: { type: Number, default: 4 },
  },
  emits: ["update:chosen"],
  data() {
    count += 1;
    return {
      uid: `run-graph-${count}`,
      trial: "all",
      tip: null,
      W: 640,
      M: { top: 10, right: 16, bottom: 44, left: 64 },
    };
  },
  computed: {
    isFull() {
      return this.chosen.length >= this.maxY;
    },
    shown() {
      if (this.trial !== "all" && this.runs[+this.trial]) return [+this.trial];
      return this.runs.map((_, i) => i);
    },
    xMax() {
      const times = this.shown.flatMap((i) =>
        (this.runs[i].series || []).map((p) => p.time).filter(isNumber)
      );
      return Math.max(1, ...times);
    },
    xTicks() {
      return ticks(0, this.xMax);
    },
    groups() {
      const byKey = Object.fromEntries(this.variables.map((v) => [v.key, v]));
      const groups = [];
      for (const key of this.chosen) {
        const v = byKey[key];
        if (!v) continue;
        const unit = v.unit || "";
        let group = groups.find((g) => g.unit === unit);
        if (!group) groups.push((group = { unit, vars: [] }));
        group.vars.push(v);
      }
      const plotHeight = groups.length > 1 ? 160 : 280;
      return groups.map((g) => this.layout(g, plotHeight));
    },
  },
  methods: {
    isChosen(key) {
      return this.chosen.includes(key);
    },
    toggle(key, on) {
      const next = on
        ? [...this.chosen.filter((k) => k !== key), key]
        : this.chosen.filter((k) => k !== key);
      this.$emit("update:chosen", next.slice(0, this.maxY));
    },
    colorOf(key) {
      const i = this.variables.findIndex((v) => v.key === key);
      return COLORS[Math.max(i, 0) % COLORS.length];
    },
    dashOf(i) {
      return DASHES[i % DASHES.length];
    },
    heading(v) {
      return v.unit ? `${v.label} (${v.unit})` : v.label;
    },
    x(t) {
      const max = this.xTicks[this.xTicks.length - 1];
      return this.M.left + (t / max) * (this.W - this.M.left - this.M.right);
    },
    /** Scales, title and lines of one graph. */
    layout(group, plotHeight) {
      const values = group.vars.flatMap((v) =>
        this.shown.flatMap((i) =>
          (this.runs[i].series || []).map((p) => p[v.key]).filter(isNumber)
        )
      );
      const lo = Math.min(0, ...values);
      const hi = Math.max(lo === 0 ? 1 : 0, ...values);
      const yTicks = ticks(lo, hi);
      const min = yTicks[0];
      const max = yTicks[yTicks.length - 1];
      const top = this.M.top;
      const y = (v) =>
        top + plotHeight - ((v - min) / (max - min || 1)) * plotHeight;
      const names = group.vars.map((v, n) =>
        n ? v.label.toLowerCase() : v.label
      );
      const unit = group.unit ? ` (${group.unit})` : "";
      const axis =
        group.vars.length > 1
          ? `${QUANTITIES[group.unit] || "Value"}${unit}`
          : `${group.vars[0].label}${unit}`;
      const last = this.runs.length - 1;
      const lines = [];
      for (const v of group.vars) {
        for (const i of this.shown) {
          const points = (this.runs[i].series || [])
            .filter((p) => isNumber(p.time) && isNumber(p[v.key]))
            .map((p) => `${this.x(p.time)},${y(p[v.key])}`)
            .join(" ");
          if (!points) continue;
          lines.push({
            id: `${v.key}-${i}`,
            points,
            color: this.colorOf(v.key),
            dash: this.dashOf(i),
            latest: i === last && this.shown.length > 1,
          });
        }
      }
      return {
        ...group,
        title: `${names.join(" and ")} against time`,
        axis,
        ticks: yTicks,
        y,
        crossesZero: min < 0 && max > 0,
        plotHeight,
        height: top + plotHeight + this.M.bottom,
        lines,
      };
    },
    /** The nearest recorded value under the pointer, as a tooltip. */
    point(event, group) {
      const svg = event.currentTarget;
      const box = svg.getBoundingClientRect();
      const scale = this.W / box.width;
      const px = (event.clientX - box.left) * scale;
      const py = (event.clientY - box.top) * scale;
      const max = this.xTicks[this.xTicks.length - 1];
      const time =
        ((px - this.M.left) / (this.W - this.M.left - this.M.right)) * max;
      let best = null;
      for (const v of group.vars) {
        for (const i of this.shown) {
          for (const p of this.runs[i].series || []) {
            if (!isNumber(p.time) || !isNumber(p[v.key])) continue;
            const d = Math.hypot(this.x(p.time) - px, group.y(p[v.key]) - py);
            if (!best || d < best.d) best = { d, p, v, i };
          }
        }
      }
      if (!best || best.d > 18 || time < 0) {
        this.tip = null;
        return;
      }
      const round = (n) =>
        n.toLocaleString(undefined, { maximumFractionDigits: 2 });
      const plots = this.$refs.plots.getBoundingClientRect();
      this.tip = {
        text: `${best.v.label} ${round(best.p[best.v.key])}${
          best.v.unit ? ` ${best.v.unit}` : ""
        } at ${round(best.p.time)} s · ${this.runs[best.i].label}`,
        left: event.clientX - plots.left + 12,
        top: event.clientY - plots.top - 30,
      };
    },
  },
};
</script>

<style scoped>
.picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin: 0 0 4px;
  padding: 0;
  border: 0;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1.5px solid var(--inq-soft-border, #cfc9df);
  border-radius: 16px;
  padding: 3px 10px;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
}
.chip input {
  margin: 0;
}
.chip i {
  display: inline-block;
  width: 14px;
  height: 4px;
}
.chip.on {
  border-color: var(--inq-ink, #2e2645);
  background: var(--inq-tint, #f4f2f9);
}
.chip.off {
  opacity: 0.5;
  cursor: not-allowed;
}
.hint {
  font-size: 13px;
  color: var(--inq-muted, #5c5670);
  margin: 0 0 6px;
}
.trials {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 6px;
}
.trials .form-select {
  width: auto;
}
.plots {
  position: relative;
}
.plot {
  margin: 8px 0 0;
}
.plot-title {
  font-weight: 600;
  font-size: 14px;
  padding-left: 64px;
}
.key {
  font-weight: 400;
  margin-left: 12px;
  white-space: nowrap;
}
.key i {
  display: inline-block;
  width: 14px;
  height: 4px;
  margin-right: 5px;
  vertical-align: middle;
}
svg {
  width: 100%;
  height: auto;
  font-size: 12px;
}
.grid line {
  stroke: var(--inq-line, #ddd8ea);
}
.zero {
  stroke: var(--inq-ink, #2e2645);
  stroke-width: 1.5;
}
.axis line {
  stroke: var(--inq-muted, #5c5670);
}
.axis text {
  fill: var(--inq-ink, #2e2645);
}
.tip {
  position: absolute;
  background: var(--inq-ink, #2e2645);
  color: #fff;
  font-size: 13px;
  padding: 3px 8px;
  border-radius: 4px;
  pointer-events: none;
  white-space: nowrap;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  justify-content: center;
  font-size: 14px;
  margin: 6px 0 0;
}
.legend svg {
  width: 28px;
  vertical-align: middle;
  margin-right: 4px;
}
.legend line {
  stroke: var(--inq-ink, #2e2645);
  stroke-width: 2.5;
}
</style>
