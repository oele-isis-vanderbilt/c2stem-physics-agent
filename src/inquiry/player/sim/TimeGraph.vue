<template>
  <figure class="time-graph mb-0">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="`${yTitle} against time, ${lines.length} trials`"
    >
      <g class="grid">
        <line
          v-for="t in yTicks"
          :key="'y' + t"
          :x1="M.left"
          :x2="W - M.right"
          :y1="y(t)"
          :y2="y(t)"
        />
      </g>
      <g class="axis">
        <line :x1="M.left" :x2="M.left" :y1="M.top" :y2="H - M.bottom" />
        <line
          :x1="M.left"
          :x2="W - M.right"
          :y1="H - M.bottom"
          :y2="H - M.bottom"
        />
        <text
          v-for="t in xTicks"
          :key="'xt' + t"
          :x="x(t)"
          :y="H - M.bottom + 18"
          text-anchor="middle"
        >
          {{ t }}
        </text>
        <text
          v-for="t in yTicks"
          :key="'yt' + t"
          :x="M.left - 8"
          :y="y(t) + 4"
          text-anchor="end"
        >
          {{ t }}
        </text>
        <text :x="(M.left + W - M.right) / 2" :y="H - 6" text-anchor="middle">
          Time (s)
        </text>
        <text
          :transform="`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`"
          text-anchor="middle"
        >
          {{ yTitle }}
        </text>
      </g>
      <polyline
        v-for="line in lines"
        :key="line.label"
        :points="line.points"
        :stroke="line.color"
        :stroke-width="line.latest ? 3 : 2"
        fill="none"
      />
    </svg>
    <figcaption class="legend">
      <span v-for="line in lines" :key="line.label">
        <i :style="{ background: line.color }"></i>{{ line.label }}
      </span>
    </figcaption>
  </figure>
</template>

<script>
const COLORS = ["#615195", "#d9822b", "#2a9d8f", "#c0392b", "#3a6ea5"];

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

/** One line per run with a series, against time. The newest run is thicker. */
export default {
  name: "TimeGraph",
  props: {
    runs: { type: Array, required: true }, // [{ label, series }]
    yKey: { type: String, required: true },
    yTitle: { type: String, required: true },
  },
  data() {
    return {
      W: 600,
      H: 320,
      M: { top: 12, right: 16, bottom: 44, left: 56 },
    };
  },
  computed: {
    points() {
      return this.runs.map((run) =>
        (run.series || []).filter(
          (p) => p.time !== null && p[this.yKey] !== null
        )
      );
    },
    bounds() {
      const all = this.points.flat();
      const xs = all.map((p) => p.time);
      const ys = all.map((p) => p[this.yKey]);
      return {
        xMax: Math.max(1, ...xs),
        yMin: Math.min(0, ...ys),
        yMax: Math.max(1, ...ys),
      };
    },
    xTicks() {
      return ticks(0, this.bounds.xMax);
    },
    yTicks() {
      return ticks(this.bounds.yMin, this.bounds.yMax);
    },
    lines() {
      const last = this.runs.length - 1;
      return this.runs
        .map((run, i) => ({
          label: run.label,
          color: COLORS[i % COLORS.length],
          latest: i === last,
          points: this.points[i]
            .map((p) => `${this.x(p.time)},${this.y(p[this.yKey])}`)
            .join(" "),
        }))
        .filter((line) => line.points);
    },
  },
  methods: {
    x(t) {
      const xs = this.xTicks;
      const max = xs[xs.length - 1];
      return this.M.left + (t / max) * (this.W - this.M.left - this.M.right);
    },
    y(v) {
      const ys = this.yTicks;
      const min = ys[0];
      const max = ys[ys.length - 1];
      const h = this.H - this.M.top - this.M.bottom;
      return this.M.top + h - ((v - min) / (max - min || 1)) * h;
    },
  },
};
</script>

<style scoped>
svg {
  width: 100%;
  height: auto;
  font-size: 12px;
}
.grid line {
  stroke: var(--inq-line, #ddd8ea);
}
.axis line {
  stroke: var(--inq-muted, #5c5670);
}
.axis text {
  fill: var(--inq-ink, #2e2645);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  justify-content: center;
  font-size: 14px;
}
.legend i {
  display: inline-block;
  width: 14px;
  height: 4px;
  margin-right: 6px;
  vertical-align: middle;
}
</style>
